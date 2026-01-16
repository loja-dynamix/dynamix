// /api/notificar.js  (CommonJS - Vercel friendly)

module.exports = async function handler(req, res) {
  // CORS básico (se você chamar do seu site no mesmo domínio, ok também)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const { cliente, pedido, to, subject, html, text } = body;

    // =========================
    // PARTE 1: Formspree (vendedor) - opcional
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
        Array.isArray(pedido?.itens) ? pedido.itens.map((i) => i?.name).filter(Boolean).join(", ") : "-"
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

        vendedorStatus = r.status;
        okVendedor = r.ok;
        if (!r.ok) vendedorErr = await r.text().catch(() => "");
      } catch (e) {
        vendedorErr = String(e?.message || e);
      }
    }

    // =========================
    // PARTE 2: MailerSend (cliente)
    // =========================
    let okCliente = false;

    // Só tenta enviar se vier "to" e conteúdo
    if (to && (html || text)) {
      const MS_KEY = (process.env.MAILERSEND_API_KEY || "").trim();
      const FROM_EMAIL = (process.env.MAIL_FROM_EMAIL || "").trim(); // precisa ser remetente verificado
      const FROM_NAME = (process.env.MAIL_FROM_NAME || "Dynamix").trim();

      // Debug útil: mostra se as envs existem (sem vazar valores)
      if (!MS_KEY || !FROM_EMAIL) {
        return res.status(500).json({
          ok: false,
          error: "Config faltando: MAILERSEND_API_KEY / MAIL_FROM_EMAIL",
          debug: {
            has_MAILERSEND_API_KEY: Boolean(MS_KEY),
            has_MAIL_FROM_EMAIL: Boolean(FROM_EMAIL),
            env_runtime_hint:
              "Confira se você cadastrou as variáveis no MESMO projeto da Vercel e no ambiente certo (Production/Preview) e fez Redeploy.",
          },
          okVendedor,
          vendedorStatus,
          vendedorErr,
          okCliente: false,
        });
      }

      const safeText = String(text || "Pagamento confirmado. Em breve enviaremos o rastreio.");

      const payload = {
        from: { email: FROM_EMAIL, name: FROM_NAME },
        to: [{ email: String(to).trim() }],
        subject: subject || "Pagamento Confirmado - Dynamix",
        text: safeText,
        html:
          html ||
          `<p>${safeText
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br>")}</p>`,
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

      // MailerSend geralmente retorna 202 quando aceitou
      if (!(resp.status === 202 || resp.ok)) {
        const errText = await resp.text().catch(() => "");
        return res.status(resp.status || 500).json({
          ok: false,
          error: "Falha ao enviar e-mail via MailerSend",
          status: resp.status,
          details: errText,
          okVendedor,
          vendedorStatus,
          vendedorErr,
          okCliente: false,
        });
      }

      okCliente = true;
    }

    return res.status(200).json({
      ok: true,
      okVendedor,
      vendedorStatus,
      vendedorErr,
      okCliente,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "Internal error",
      details: String(e?.message || e),
    });
  }
};
