const nodemailer = require('nodemailer');

export default async function handler(req, res) {
    // Permissões (CORS)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    const { cliente, pedido, entrega, to, subject, html } = req.body;

    // --- PARTE 1: NOTIFICAÇÃO DO VENDEDOR (FORMSPREE) ---
    if (cliente && pedido) {
        const mensagemFormspree = `
        NOVO PEDIDO APROVADO! 🚀
        CLIENTE: ${cliente.nome} (${cliente.email})
        ID PAGAMENTO: ${pedido.id_pagamento}
        TOTAL: R$ ${pedido.total}
        ITENS: ${pedido.itens ? pedido.itens.map(i => i.name).join(', ') : 'Erro ao listar'}
        `;

        try {
            await fetch('https://formspree.io/f/xykznlnr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: cliente.email,
                    message: mensagemFormspree,
                    subject: `Novo Pedido #${pedido.id_pagamento}`
                })
            });
        } catch (e) { console.error("Erro Formspree:", e); }
    }

    // --- PARTE 2: ENVIO PARA O CLIENTE (ZOHO SMTP) ---
    if (to && html) {
        const transporter = nodemailer.createTransport({
            host: process.env.ZOHO_SMTP_HOST,
            port: parseInt(process.env.ZOHO_SMTP_PORT) || 465,
            secure: true,
            auth: {
                user: process.env.ZOHO_SMTP_USER,
                pass: process.env.ZOHO_SMTP_PASS,
            },
        });

        try {
            await transporter.sendMail({
                from: process.env.EMAIL_FROM,
                to: to,
                subject: subject || "Pagamento Confirmado - Dynamix",
                html: html,
            });
        } catch (e) { console.error("Erro Zoho SMTP:", e); }
    }

    return res.status(200).json({ ok: true, success: true });
}
