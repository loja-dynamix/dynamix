const nodemailer = require('nodemailer');

export default async function handler(req, res) {
  // Garante que apenas requisições POST funcionem
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { to, subject, html } = req.body;

  // Configuração usando EXATAMENTE os nomes da sua captura de tela
  const transporter = nodemailer.createTransport({
    host: process.env.ZOHO_SMTP_HOST, 
    port: parseInt(process.env.ZOHO_SMTP_PORT) || 465,
    secure: true, // true para porta 465
    auth: {
      user: process.env.ZOHO_SMTP_USER, // Conforme sua imagem
      pass: process.env.ZOHO_SMTP_PASS, 
    },
  });

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM, // Conforme sua imagem
      to: to,
      subject: subject,
      html: html,
    });

    console.log("E-mail enviado com sucesso para:", to);
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Erro detalhado do SMTP:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
