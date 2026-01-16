// ========================= INICIO: /api/notificar.js =========================
export default async function handler(req, res) {
  // --- CORS básico ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const { cliente, pedido, to, subject, html, text } = body;

    // =========================
    // PARTE 1: Formspree (vendedor)
    // =========================
    let okVendedor = false;
    let vendedorError = null;

    if (cliente && pedido) {
      const nome = (cliente?.nome || "Cliente").toString();
      const email = (cliente?.email || "").toString();
      const idPagamento = (pedido?.id_pagamento || pedido?.id || "N/A").toString();
      const total = pedido?.total != null ? String(pedido.total) : "N/A";
      const itens = Array.isArray(pedido?.itens)
        ? pedido.itens.map((i) => i?.name || i?.title || "Item").join(", ")
        : "N/A";

      const mensagemFormspree = `
NOVO PEDIDO APROVADO! 🚀
CLIENTE: ${nome} (${email})
ID PAGAMENTO: ${idPagamento}
TOTAL: R$ ${total}
ITENS: ${itens}
      `.trim();

      try {
        const r = await fetch("https://formspree.io/f/xykznlnr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            message: mensagemFormspree,
            subject: `Novo Pedido #${idPagamento}`,
          }),
        });

        okVendedor = r.ok;
        if (!r.ok) {
          const err = await r.text().catch(() => "");
          vendedorError = `Formspree falhou: ${r.status} ${err}`.trim();
          console.error(vendedorError);
        }
      } catch (e) {
        vendedorError = "Erro Formspree: " + (e?.message || String(e));
        console.error(vendedorError);
      }
    }

    // =========================
    // PARTE 2: MailerSend (cliente)
    // =========================
    let okCliente = false;

    // validação mínima do que é necessário pra enviar
    const toEmail = (to || "").toString().trim();
    const hasBody = Boolean((html && String(html).trim()) || (text && String(text).trim()));

    if (!toEmail || !hasBody) {
      return res.status(400).json({
        ok: false,
        error: "Dados insuficientes para enviar ao cliente. Envie: to + (html ou text).",
        okVendedor,
        okCliente: false,
      });
    }

    const MS_KEY = process.env.MAILERSEND_API_KEY;
    const FROM_EMAIL = process.env.MAIL_FROM_EMAIL; // precisa ser remetente válido no MailerSend
    const FROM_NAME = process.env.MAIL_FROM_NAME || "Dynamix";

    if (!MS_KEY || !FROM_EMAIL) {
      return res.status(500).json({
        ok: false,
        error:
          "Config faltando no servidor: MAILERSEND_API_KEY e/ou MAIL_FROM_EMAIL. Configure na Vercel e faça redeploy.",
        okVendedor,
        okCliente: false,
      });
    }

    const safeText =
      (text && String(text)) ||
      "Pagamento confirmado. Em breve enviaremos o rastreio.";

    const safeHtml =
      (html && String(html)) ||
      `<p>${safeText
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>")}</p>`;

    const payload = {
      from: { email: FROM_EMAIL, name: FROM_NAME },
      to: [{ email: toEmail }],
      subject: (subject && String(subject)) || "Pagamento Confirmado - Dynamix",
      text: safeText,
      html: safeHtml,
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

    // MailerSend geralmente responde 202 quando aceitou o envio
    if (!(resp.status === 202 || resp.ok)) {
      const errText = await resp.text().catch(() => "");
      console.error("MailerSend error:", resp.status, errText);

      return res.status(resp.status).json({
        ok: false,
        error: "Falha ao enviar e-mail via MailerSend",
        details: errText,
        okVendedor,
        okCliente: false,
      });
    }

    okCliente = true;

    // Resultado final
    return res.status(200).json({
      ok: true,
      okVendedor,
      okCliente,
      vendedorError,
    });
  } catch (e) {
    console.error("Erro geral /api/notificar:", e);
    return res.status(500).json({
      ok: false,
      error: "Internal error",
      details: e?.message || String(e),
    });
  }
}
// ========================== FIM: /api/notificar.js =========================
