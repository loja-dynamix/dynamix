export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { cliente, pedido, to, subject, html, text } = req.body || {};

    // ====== DIAGNÓSTICO DE AMBIENTE ======
    const envInfo = {
      vercelEnv: process.env.VERCEL_ENV || null,
      vercelUrl: process.env.VERCEL_URL || null,
      has_MAILERSEND_API_KEY: !!process.env.MAILERSEND_API_KEY,
      has_MAIL_FROM_EMAIL: !!process.env.MAIL_FROM_EMAIL,
      has_MAIL_FROM_NAME: !!process.env.MAIL_FROM_NAME,
      mailKeys: Object.keys(process.env).filter((k) => k.includes("MAIL")).sort(),
    };

    // =========================
    // PARTE 1: Formspree (vendedor)
    // =========================
    let okVendedor = false;
    if (cliente && pedido) {
      const mensagemFormspree = `
NOVO PEDIDO APROVADO! 🚀
CLIENTE: ${cliente?.nome || "-"} (${cliente?.email || "-"})
ID PAGAMENTO: ${pedido?.id_pagamento || "-"}
TOTAL: R$ ${pedido?.total || "-"}
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
      } catch (e) {
        console.error("Erro Formspree:", e);
      }
    }

    // =========================
    // PARTE 2: MailerSend (cliente)
    // =========================
    let okCliente = false;

    if (to && (html || text)) {
      const MS_KEY = process.env.MAILERSEND_API_KEY;
      const FROM_EMAIL = process.env.MAIL_FROM_EMAIL;
      const FROM_NAME = process.env.MAIL_FROM_NAME || "Dynamix";

      if (!MS_KEY || !FROM_EMAIL) {
        // aqui devolve diagnóstico completo
        return res.status(500).json({
          ok: false,
          error: "Config faltando: MAILERSEND_API_KEY / MAIL_FROM_EMAIL",
          envInfo,
          okVendedor,
          okCliente: false,
        });
      }

      const payload = {
        from: { email: FROM_EMAIL, name: FROM_NAME },
        to: [{ email: String(to).trim() }],
        subject: subject || "Pagamento Confirmado - Dynamix",
        text: text || "Pagamento confirmado. Em breve enviaremos o rastreio.",
        html:
          html ||
          `<p>${String(text || "")
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

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        console.error("MailerSend error:", resp.status, errText);

        return res.status(resp.status).json({
          ok: false,
          error: "Falha ao enviar e-mail via MailerSend",
          details: errText,
          envInfo,
          okVendedor,
          okCliente: false,
        });
      }

      okCliente = true;
    }

    return res.status(200).json({
      ok: true,
      okVendedor,
      okCliente,
      envInfo,
    });
  } catch (e) {
    console.error("Erro geral /api/notificar:", e);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
}
