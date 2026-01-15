import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const { to, subject, html } = req.body || {};
    if (!to || !subject || !html) {
      return res.status(400).json({ ok: false, error: "Campos obrigatórios: to, subject, html" });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.zoho.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.ZOHO_EMAIL,
        pass: process.env.ZOHO_PASSWORD,
      },
    });

    const info = await transporter.sendMail({
      from: `"Dynamix" <${process.env.ZOHO_EMAIL}>`, // IMPORTANTE: tem que ser o mesmo do login do Zoho
      to,
      subject,
      html,
    });

    return res.status(200).json({ ok: true, messageId: info.messageId });
  } catch (err) {
    console.error("Erro no Nodemailer/Zoho:", err);
    return res.status(500).json({ ok: false, error: "Falha ao enviar e-mail" });
  }
}
