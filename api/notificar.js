export default async function handler(req, res) {
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
    if (cliente && pedido) {
      const mensagemFormspree = `
NOVO PEDIDO APROVADO! 🚀
CLIENTE: ${cliente.nome} (${cliente.email})
ID PAGAMENTO: ${pedido.id_pagamento}
TOTAL: R$ ${pedido.total}
ITENS: ${pedido.itens ? pedido.itens.map(i => i.name).join(", ") : "Erro ao listar"}
      `.trim();

      try {
        const r = await fetch("https://formspree.io/f/xykznlnr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: cliente.email,
            message: mensagemFormspree,
            subject: `Novo Pedido #${pedido.id_pagamento}`,
          }),
        });

        okVendedor = r.ok;
      } catch (e) {
        console.error("Erro Formspree:", e);
      }
    }

    // =========================
    // PARTE 2: Mailjet (cliente)
    // =========================
    let okCliente = false;

    // Se você quiser que o endpoint sirva tanto vendedor quanto cliente,
    // não obrigue 'to/html'. Mas se vier, valida e tenta enviar.
    if (to && (html || text)) {
      const MJ_KEY = process.env.MAILJET_API_KEY;
      const MJ_SECRET = process.env.MAILJET_API_SECRET;
      const FROM_EMAIL = process.env.MAIL_FROM_EMAIL; // ex: contato@seudominio.com.br
      const FROM_NAME = process.env.MAIL_FROM_NAME || "Dynamix";

      if (!MJ_KEY || !MJ_SECRET || !FROM_EMAIL) {
        return res.status(500).json({
          ok: false,
          error:
            "Config faltando: MAILJET_API_KEY / MAILJET_API_SECRET / MAIL_FROM_EMAIL",
        });
      }

      const payload = {
        Messages: [
          {
            From: { Email: FROM_EMAIL, Name: FROM_NAME },
            To: [{ Email: to }],
            Subject: subject || "Pagamento Confirmado - Dynamix",
            TextPart: text || "Pagamento confirmado. Em breve enviaremos o rastreio.",
            HTMLPart: html || `<p>${String(text || "").replace(/\n/g, "<br>")}</p>`,
          },
        ],
      };

      const basicAuth = Buffer.from(`${MJ_KEY}:${MJ_SECRET}`).toString("base64");

      const resp = await fetch("https://api.mailjet.com/v3.1/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${basicAuth}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        console.error("Mailjet error:", data);
        return res.status(400).json({
          ok: false,
          error: "Falha ao enviar e-mail via Mailjet",
          details: data,
          okVendedor,
          okCliente: false,
        });
      }

      okCliente = true;
    }

    // Resultado final (bem honesto)
    return res.status(200).json({
      ok: true,
      okVendedor,
      okCliente,
    });
  } catch (e) {
    console.error("Erro geral /api/notificar:", e);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
}
