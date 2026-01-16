// /api/notificar.js
import nodemailer from "nodemailer";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { cliente, pedido, to, subject, html, text, debug } = req.body || {};

    // =========================
    // PARTE 1: Formspree (vendedor)
    // =========================
    let okVendedor = false;
    let vendedorStatus = null;
    let vendedorErr = "";

    if (cliente && pedido) {
      const mensagemFormspree = `
NOVO PEDIDO APROVADO! 🚀
CLIENTE: ${cliente?.nome || "-"} (${cliente?.email || "-"})
ID PAGAMENTO: ${pedido?.id_pagamento || "-"}
TOTAL: R$ ${pedido?.total ?? "-"}
ITENS: ${
        Array.isArray(pedido?.itens)
          ? pedido.itens.map((i) => i?.name).filter(Boolean).join(", ")
          : "-"
      }
      `.trim();

      try {
        const r = await fetch("https://formspree.io/f/xykznlnr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: cliente?.email || "",
            message: mensagemFormspree,
            subject: `Novo Pedido #${pedido?.id_pagamento || ""}`,
          }),
        });

        okVendedor = r.ok;
        vendedorStatus = r.status;
        if (!r.ok) vendedorErr = await r.text().catch(() => "");
      } catch (e) {
        vendedorErr = String(e?.message || e);
      }
    }

    // =========================
    // PARTE 2: SMTP (Zoho) - cliente
    // =========================
    const SMTP_HOST = (process.env.ZOHO_SMTP_HOST || "").trim();
    const SMTP_PORT = Number(process.env.ZOHO_SMTP_PORT || "465");
    const SMTP_USER = (process.env.ZOHO_SMTP_USER || "").trim();
    const SMTP_PASS = (process.env.ZOHO_SMTP_PASS || "").trim();

    // Remetente (pode ser o próprio SMTP_USER)
    const FROM_EMAIL = (process.env.MAIL_FROM_EMAIL || SMTP_USER || "").trim();
    const FROM_NAME = (process.env.MAIL_FROM_NAME || "Dynamix").trim();

    const envInfo = {
      vercelEnv: process.env.VERCEL_ENV || null,
      has_SMTP_HOST: Boolean(SMTP_HOST),
      has_SMTP_PORT: Boolean(SMTP_PORT),
      has_SMTP_USER: Boolean(SMTP_USER),
      has_SMTP_PASS: Boolean(SMTP_PASS),
      from_email_used: FROM_EMAIL || null,
      smtp_port_used: SMTP_PORT,
    };

    if (debug === true) {
      return res.status(200).json({
        ok: true,
        envInfo,
        okVendedor,
        vendedorStatus,
        vendedorErr,
      });
    }

    let okCliente = false;

    if (to && (html || text)) {
      if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
        return res.status(500).json({
          ok: false,
          error:
            "Config faltando SMTP: ZOHO_SMTP_HOST / ZOHO_SMTP_USER / ZOHO_SMTP_PASS (e ZOHO_SMTP_PORT)",
          okVendedor,
          okCliente: false,
          envInfo,
        });
      }

      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465, // 465 = SSL, 587 = STARTTLS
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });

      const safeText =
        typeof text === "string"
          ? text
          : "Pagamento confirmado. Em breve enviaremos o rastreio.";

      const safeHtml =
        typeof html === "string" && html.trim()
          ? html
          : `<p>${String(safeText)
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/\n/g, "<br>")}</p>`;

      try {
        await transporter.sendMail({
          from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
          to: String(to).trim(),
          subject: subject || "Pagamento Confirmado - Dynamix",
          text: safeText,
          html: safeHtml,
        });

        okCliente = true;
      } catch (e) {
        return res.status(500).json({
          ok: false,
          error: "Falha ao enviar e-mail via SMTP (Zoho)",
          details: String(e?.message || e),
          okVendedor,
          okCliente: false,
          envInfo,
          hint:
            "Se der erro de auth, confirme usuário/senha SMTP e se o Zoho exige app-password/SMTP habilitado.",
        });
      }
    }

    return res.status(200).json({
      ok: true,
      okVendedor,
      okCliente,
      vendedorStatus,
      vendedorErr,
      envInfo,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Internal error",
      details: String(e?.message || e),
    });
  }
}
