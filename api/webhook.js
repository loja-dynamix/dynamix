const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

const db = admin.firestore();

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Método não permitido');

  const { type, data } = req.body;

  if (type === "payment") {
    try {
      const paymentId = data.id;
      // Busca detalhes no Mercado Pago
      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` }
      });
      const paymentData = await mpRes.json();
      const pedidoId = paymentData.external_reference;

      if (pedidoId && paymentData.status === "approved") {
        // Busca o pedido em qualquer subcoleção 'orders' usando o campo pedidoId
        const snapshot = await db.collectionGroup('orders')
                                 .where('pedidoId', '==', pedidoId)
                                 .get();

        if (!snapshot.empty) {
          const docRef = snapshot.docs[0].ref;
          await docRef.update({
            status: 'Pago',
            id_pagamento_real: String(paymentId),
            data_pagamento: admin.firestore.FieldValue.serverTimestamp(),
            metodo_confirmacao: 'Webhook Automatizado'
          });
          console.log(`✅ Pedido ${pedidoId} aprovado com sucesso!`);
          return res.status(200).json({ message: "Sucesso" });
        }
      }
    } catch (error) {
      console.error("Erro no Webhook:", error.message);
      return res.status(500).send("Erro Interno");
    }
  }
  res.status(200).send("OK");
};
