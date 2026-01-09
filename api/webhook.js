// api/webhook.js
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";

// Suas configurações do Firebase (Copie do seu index.html)
const firebaseConfig = {
    apiKey: "AIzaSyCcxUtccSBADIElGz6FHrIMAEFyI99njvU",
    authDomain: "dynamix-3cb48.firebaseapp.com",
    projectId: "dynamix-3cb48",
    storageBucket: "dynamix-3cb48.firebasestorage.app",
    messagingSenderId: "752736250186",
    appId: "1:752736250186:web:3787663031d273e9bd79b3"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { type, data } = req.body;

    // Queremos apenas notificações de pagamento
    if (type === "payment") {
        const paymentId = data.id;
        const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

        try {
            // 1. Consultar o Mercado Pago para saber os detalhes desse pagamento
            const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
                headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
            });
            const paymentData = await response.json();

            // O external_reference é o ID do pedido que enviamos no checkout
            const pedidoId = paymentData.external_reference;
            const statusReal = paymentData.status;

            if (pedidoId && statusReal === "approved") {
                // 2. Buscar em TODOS os usuários o pedido que tem esse ID (já que no webhook não sabemos o UID do user)
                // Uma forma mais fácil é salvar o UID no external_reference ou fazer uma busca por coleção de grupos
                // Aqui vamos assumir que você gravou o ID do pedido corretamente
                
                // NOTA: Como você usa subcoleções por usuário, o ideal é salvar o UID no metadata do MP
                // ou simplificar a busca. Para este exemplo, vamos atualizar via ID global se você tiver acesso.
                console.log(`Pedido ${pedidoId} aprovado com sucesso!`);
                
                // Aqui você deve implementar a lógica para localizar o documento no Firestore
                // e atualizar para 'Pago' e gravar o paymentId real.
            }
        } catch (error) {
            console.error("Erro no Webhook:", error);
        }
    }

    res.status(200).send("OK");
}