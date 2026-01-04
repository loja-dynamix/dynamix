import { MercadoPagoConfig, Payment } from 'mercadopago';
import nodemailer from 'nodemailer';
import fetch from 'node-fetch'; // Para chamar o Formspree

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const payment = new Payment(client);

// Configuração do Brevo (Antigo Sendinblue) via SMTP
const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.BREVO_USER, // Seu login no Brevo (e-mail)
        pass: process.env.BREVO_PASS, // Sua chave SMTP (Master Password) do Brevo
    },
});

export default async function handler(req, res) {
    const { id } = req.query;

    if (!id || id === 'undefined') {
        return res.status(400).json({ error: "ID ausente" });
    }

    try {
        // 1. Consulta o Mercado Pago
        const paymentData = await payment.get({ id: id });
        const status = paymentData.status; // 'approved', 'pending', etc.
        
        // Se estiver PAGO, dispara os e-mails
        if (status === 'approved') {
            
            // Dados para os e-mails
            const emailCliente = paymentData.payer.email;
            const itensCompra = paymentData.additional_info?.items || [];
            // O endereço vem dentro de additional_info.shipments.receiver_address se você configurou a preference corretamente,
            // senão pode vir vazio. Vamos tentar pegar o máximo de dados.
            const endereco = paymentData.additional_info?.shipments?.receiver_address || {};
            
            // Formata endereço para string
            const enderecoString = `${endereco.street_name || 'Rua'}, ${endereco.street_number || 'S/N'} - ${endereco.zip_code || ''} - ${endereco.city || ''}/${endereco.state_name || ''}`;
            
            // Lista de produtos HTML
            const listaProdutosHTML = itensCompra.map(i => `<li>${i.title} - R$ ${i.unit_price}</li>`).join('');

            // --- AÇÃO 1: E-mail para o CLIENTE (Bonitinho) ---
            try {
                await transporter.sendMail({
                    from: '"Dynamix Suplementos" <contato@asthro.com.br>', // Use um e-mail validado no Brevo
                    to: emailCliente,
                    subject: "Seu pagamento foi confirmado! 🚀",
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
                            <div style="background-color: #1768ac; padding: 20px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0;">Pagamento Confirmado!</h1>
                            </div>
                            <div style="padding: 20px; background-color: #ffffff;">
                                <p style="font-size: 16px; color: #333;">Olá,</p>
                                <p style="font-size: 16px; color: #333;">Temos ótimas notícias! O pagamento do seu pedido <strong>#${id}</strong> foi confirmado e já estamos preparando tudo.</p>
                                
                                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                    <h3 style="color: #1768ac; margin-top: 0;">Resumo do Pedido:</h3>
                                    <ul style="color: #555;">
                                        ${listaProdutosHTML}
                                    </ul>
                                    <p><strong>Total Pago:</strong> R$ ${paymentData.transaction_amount}</p>
                                    <p><strong>Entrega em:</strong> ${enderecoString}</p>
                                </div>

                                <p style="font-size: 14px; color: #777;">Em breve você receberá o código de rastreio.</p>
                            </div>
                            <div style="background-color: #f1f1f1; padding: 15px; text-align: center; font-size: 12px; color: #888;">
                                © 2026 Dynamix - Asthro Agency
                            </div>
                        </div>
                    `
                });
                console.log("E-mail cliente enviado.");
            } catch (errEmail) {
                console.error("Erro ao enviar e-mail cliente:", errEmail);
            }

            // --- AÇÃO 2: E-mail para VOCÊ (Formspree) ---
            try {
                const adminData = {
                    assunto: "NOVA VENDA CONFIRMADA ✅",
                    pedido_id: id,
                    cliente_email: emailCliente,
                    cliente_nome: paymentData.payer.first_name || "Cliente",
                    produtos: itensCompra.map(i => i.title).join(', '),
                    valor_total: paymentData.transaction_amount,
                    endereco_entrega: enderecoString,
                    status: status
                };

                await fetch('https://formspree.io/f/xykznlnr', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(adminData)
                });
                console.log("E-mail admin enviado.");
            } catch (errAdmin) {
                console.error("Erro ao enviar Formspree:", errAdmin);
            }
        }

        // Retorna o status para o Frontend exibir o alerta
        res.status(200).json({ 
            status: status, 
            status_detail: paymentData.status_detail,
            payment_type: paymentData.payment_type_id 
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao verificar pagamento", details: error.message });
    }
}
