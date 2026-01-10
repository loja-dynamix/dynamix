import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collectionGroup, query, where, getDocs, updateDoc, doc } from "firebase/firestore";

const firebaseConfig = { /* Suas configs permanecem iguais */ };
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { type, data } = req.body;

    if (type === "payment") {
        const paymentId = data.id;
        const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

        try {
            const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
            });
            const paymentData = await response.json();
            const pedidoId = paymentData.external_reference; // ID que veio do addDoc no checkout
            const statusReal = paymentData.status;

            if (pedidoId && statusReal === "approved") {
                // BUSCA GLOBAL: Procura o pedido em todas as subcoleções 'orders' de todos os usuários
                const ordersRef = collectionGroup(db, 'orders');
                const q = query(ordersRef, where('__name__', '==', pedidoId)); 
                // Nota: __name__ refere-se ao ID do documento no Firestore
                
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const pedidoDoc = querySnapshot.docs[0];
                    await updateDoc(pedidoDoc.ref, {
                        status: 'Pago',
                        id_pagamento_real: paymentId,
                        data_aprovacao: new Date()
                    });
                    console.log(`Sucesso: Pedido ${pedidoId} atualizado para Pago.`);
                } else {
                    console.log(`Erro: Pedido ${pedidoId} não encontrado no banco.`);
                }
            }
        } catch (error) {
            console.error("Erro processando webhook:", error);
            return res.status(500).json({ error: error.message });
        }
    }
    return res.status(200).send("OK");
}
