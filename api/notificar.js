// /api/notificar.js
import nodemailer from "nodemailer";

function pickEnv(names) {
  for (const n of names) {
    const v = process.env[n];
    if (typeof v === "string" && v.trim()) return { name: n, value: v.trim() };
  }
  return { name: null, value: "" };
}

export default async function handler(req, res) {
  // CORS
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
        const r = await fetch("https://formspree.io/f/mreeewrl", {
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
    const hostPick = pickEnv(["ZOHO_SMTP_HOST", "SMTP_HOST"]);
    const userPick = pickEnv(["ZOHO_SMTP_USER", "SMTP_USER"]);
    const passPick = pickEnv(["ZOHO_SMTP_PASS", "SMTP_PASS"]);
    const portPick = pickEnv(["ZOHO_SMTP_PORT", "SMTP_PORT"]);

    const SMTP_HOST = hostPick.value;
    const SMTP_USER = userPick.value;
    const SMTP_PASS = passPick.value;

    // porta: default 465
    const SMTP_PORT = Number(portPick.value || "465") || 465;

    // Remetente
    const fromEmailPick = pickEnv(["MAIL_FROM_EMAIL", "FROM_EMAIL"]);
    const fromNamePick = pickEnv(["MAIL_FROM_NAME", "FROM_NAME"]);

    const FROM_EMAIL = (fromEmailPick.value || SMTP_USER || "").trim();
    const FROM_NAME = (fromNamePick.value || "Dynamix").trim();

    const using465 = SMTP_PORT === 465;
    const using587 = SMTP_PORT === 587;

    const envInfo = {
      vercelEnv: process.env.VERCEL_ENV || null,
      // quais variáveis ele pegou
      picked: {
        hostFrom: hostPick.name,
        portFrom: portPick.name,
        userFrom: userPick.name,
        passFrom: passPick.name ? "(set)" : null,
        fromEmailFrom: fromEmailPick.name || "(fallback SMTP_USER)",
        fromNameFrom: fromNamePick.name || "(default)",
      },
      // flags
      has_SMTP_HOST: Boolean(SMTP_HOST),
      has_SMTP_USER: Boolean(SMTP_USER),
      has_SMTP_PASS: Boolean(SMTP_PASS),
      has_FROM_EMAIL: Boolean(FROM_EMAIL),
      smtp_port_used: SMTP_PORT,
      secure_used: using465,
      requireTLS_used: using587,
      from_email_used: FROM_EMAIL || null,
    };

    // modo debug: não envia nada
    if (debug === true) {
      return res.status(200).json({
        ok: true,
        envInfo,
        okVendedor,
        vendedorStatus,
        vendedorErr,
      });
    }

    // Se não tem destinatário/conteúdo, só retorna parte do vendedor (ou ok geral)
    let okCliente = false;

    if (to && (html || text)) {
      const missing = [];
      if (!SMTP_HOST) missing.push("ZOHO_SMTP_HOST (ou SMTP_HOST)");
      if (!SMTP_USER) missing.push("ZOHO_SMTP_USER (ou SMTP_USER)");
      if (!SMTP_PASS) missing.push("ZOHO_SMTP_PASS (ou SMTP_PASS)");
      if (!FROM_EMAIL) missing.push("MAIL_FROM_EMAIL (ou FROM_EMAIL) / fallback SMTP_USER");

      if (missing.length) {
        return res.status(500).json({
          ok: false,
          error: "Config SMTP faltando",
          missing,
          okVendedor,
          okCliente: false,
          envInfo,
          hint:
            "Se você acabou de ajustar env vars, faça Redeploy do Production. Se estiver em Preview, marque as envs também pra Preview.",
        });
      }

      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: using465, // 465 = SSL
        requireTLS: using587, // 587 = STARTTLS
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      });

      const safeText =
        typeof text === "string" && text.trim()
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
          error: "Falha ao enviar e-mail via SMTP",
          details: String(e?.message || e),
          okVendedor,
          okCliente: false,
          envInfo,
          hint:
            "Se for erro de auth no Zoho, confirme se SMTP está habilitado e se precisa de App Password (principalmente se tiver 2FA).",
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

