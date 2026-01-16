// /api/notificar.js

export const config = {
  runtime: "nodejs",
};

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function safeText(resp) {
  try {
    return await resp.text();
  } catch {
    return "";
  }
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { cliente, pedido, to, subject, html, text } = req.body || {};

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
TOTAL: R$ ${pedido?.total || "-"}
ITENS: ${
        Array.isArray(pedido?.itens) ? pedido.itens.map((i) => i?.name).join(", ") : "-"
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
        if (!r.ok) vendedorErr = await safeText(r);
      } catch (e) {
        vendedorErr = String(e?.message || e);
      }
    }

    // =========================
    // PARTE 2: MailerSend (cliente)
    // =========================
    let okCliente = false;

    const MS_KEY = process.env.MAILERSEND_API_KEY;
    const FROM_EMAIL = process.env.MAIL_FROM_EMAIL;
    const FROM_NAME = process.env.MAIL_FROM_NAME || "Dynamix";

    // Debug: confirma se a função está enxergando as envs (sem expor valores)
    const envDebug = {
      has_MAILERSEND_API_KEY: Boolean(MS_KEY),
      has_MAIL_FROM_EMAIL: Boolean(FROM_EMAIL),
      mail_from_email_preview: FROM_EMAIL ? FROM_EMAIL.replace(/(.{2}).+(@.+)/, "$1***$2") : null,
    };

    // Se você quer SEMPRE enviar pro cliente, deixe essa validação assim.
    // (Se 'to' não vier, retorna erro claro)
    if (!to) {
      return res.status(400).json({
        ok: false,
        error: "Faltou o campo 'to' (email do cliente).",
        okVendedor,
        vendedorStatus,
        vendedorErr,
        debug: envDebug,
      });
    }

    if (!MS_KEY || !FROM_EMAIL) {
      return res.status(500).json({
        ok: false,
        error: "Config faltando: MAILERSEND_API_KEY / MAIL_FROM_EMAIL",
        okVendedor,
        vendedorStatus,
        vendedorErr,
        debug: envDebug,
      });
    }

    const finalText =
      text || "Pagamento confirmado. Em breve enviaremos o rastreio.";

    const finalHtml =
      html ||
      `<p>${String(finalText)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>")}</p>`;

    const payload = {
      from: { email: FROM_EMAIL, name: FROM_NAME },
      to: [{ email: String(to).trim() }],
      subject: subject || "Pagamento Confirmado - Dynamix",
      text: finalText,
      html: finalHtml,
    };

    const resp = await fetch("https://api.mailersend.com/v1/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${MS_KEY}`,
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    // MailerSend normalmente retorna 202
    if (!resp.ok) {
      const details = await safeText(resp);
      return res.status(resp.status).json({
        ok: false,
        error: "Falha ao enviar e-mail via MailerSend",
        status: resp.status,
        details, // <- AQUI vem o motivo real (domínio não verificado, sender inválido, token sem permissão etc.)
        okVendedor,
        vendedorStatus,
        vendedorErr,
        debug: envDebug,
      });
    }

    okCliente = true;

    return res.status(200).json({
      ok: true,
      okVendedor,
      vendedorStatus,
      vendedorErr,
      okCliente,
      debug: envDebug,
    });
  } catch (e) {
    console.error("Erro geral /api/notificar:", e);
    return res.status(500).json({
      ok: false,
      error: "Internal error",
      details: String(e?.message || e),
    });
  }
}
