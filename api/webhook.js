const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    // Tratamento rigoroso da chave privada
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      .replace(/\\n/g, '\n') // Converte caracteres \n em quebras reais
      .trim();              // Remove espaços ou quebras no início/fim

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
    console.log("Firebase Admin conectado com sucesso.");
  } catch (error) {
    console.error("Erro na chave do Firebase:", error.message);
  }
}

const db = admin.firestore();

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Apenas POST');

  const { type, data } = req.body;

  if (type === "payment") {
    try {
      const paymentId = data.id;
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` }
      });
      const paymentData = await mpRes.json();
      const pedidoId = paymentData.external_reference;

      if (pedidoId && paymentData.status === "approved") {
        // BUSCA PELO CAMPO pedidoId (Certifique-se que o índice existe no Firebase!)
        const snapshot = await db.collectionGroup('orders')
                                 .where('pedidoId', '==', pedidoId)
                                 .get();

        if (!snapshot.empty) {
          await snapshot.docs[0].ref.update({
            status: 'Pago',
            id_pagamento_real: String(paymentId),
            confirmacao: 'Webhook Automatizado',
            data_pago: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`✅ Pedido ${pedidoId} ATUALIZADO NO BANCO!`);
          return res.status(200).send("OK");
        } else {
          console.log(`❌ Pedido ${pedidoId} não achado no banco.`);
        }
      }
    } catch (e) {
      console.error("Erro processando:", e.message);
    }
  }
  res.status(200).send("Recebido");
};
