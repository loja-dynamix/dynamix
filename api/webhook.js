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

// No Node.js da Vercel para arquivos .js comuns, use module.exports
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Método não permitido');

  const { type, data } = req.body;
  if (type === "payment") {
    const paymentId = data.id;
    try {
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` }
      });
      const paymentData = await mpResponse.json();
      const pedidoId = paymentData.external_reference;

      if (pedidoId && paymentData.status === "approved") {
        // BUSCA POR COLLECTION GROUP
        const snapshot = await db.collectionGroup('orders')
                                 .where(admin.firestore.FieldPath.documentId(), '==', pedidoId)
                                 .get();

        if (!snapshot.empty) {
          await snapshot.docs[0].ref.update({
            status: 'Pago',
            id_pagamento_real: String(paymentId),
            data_pagamento: admin.firestore.FieldValue.serverTimestamp()
          });
          return res.status(200).json({ message: "Aprovado" });
        }
      }
    } catch (error) {
      console.error("Erro Webhook:", error);
      return res.status(500).send("Erro");
    }
  }
  res.status(200).send("OK");
};
