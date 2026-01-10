import admin from 'firebase-admin';

// Inicializa o Admin se ainda não foi inicializado
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // O replace é necessário para tratar as quebras de linha da chave na Vercel
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  } catch (error) {
    console.error('Erro na inicialização do Firebase Admin:', error);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  // Mercado Pago envia POST
  if (req.method !== 'POST') return res.status(405).send('Método não permitido');

  const { type, data } = req.body;

  // Filtrar apenas notificações de pagamento
  if (type === "payment") {
    const paymentId = data.id;

    try {
      // 1. Validar o pagamento com o Mercado Pago
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` }
      });
      const paymentData = await mpResponse.json();

      // Pegamos o ID do pedido que você salvou no addDoc (external_reference)
      const pedidoId = paymentData.external_reference;

      if (pedidoId && paymentData.status === "approved") {
        // 2. Buscar o pedido em qualquer subcoleção 'orders' de qualquer usuário
        const snapshot = await db.collectionGroup('orders')
                                 .where(admin.firestore.FieldPath.documentId(), '==', pedidoId)
                                 .get();

        if (!snapshot.empty) {
          const pedidoDoc = snapshot.docs[0];
          
          // 3. Atualizar o status (O Admin ignora suas regras de segurança)
          await pedidoDoc.ref.update({
            status: 'Pago',
            id_pagamento_real: paymentId,
            metodo_confirmacao: 'Webhook',
            data_pagamento: admin.firestore.FieldValue.serverTimestamp()
          });

          console.log(`✅ Pedido ${pedidoId} aprovado via Webhook.`);
          return res.status(200).json({ message: "Pedido atualizado" });
        } else {
          console.error(`❌ Pedido ${pedidoId} não encontrado no Firestore.`);
        }
      }
    } catch (error) {
      console.error("Erro no processamento do webhook:", error);
      return res.status(500).json({ error: "Erro interno no servidor" });
    }
  }

  // Sempre retornar 200 para o Mercado Pago não ficar reenviando o mesmo webhook
  res.status(200).send("OK");
}
