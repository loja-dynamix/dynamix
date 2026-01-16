// ========================= INICIO: /api/notificar.js =========================
const FORM_ENDPOINT = "https://formspree.io/f/xykznlnr";
const MAILERSEND_ENDPOINT = "https://api.mailersend.com/v1/email";

// CORS (ajuste o ORIGIN se quiser travar no seu domínio)
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function safeJsonParse(maybeString) {
  if (!maybeString) return {};
  if (typeof maybeString === "object") return maybeString;
  try {
    return JSON.parse(maybeString);
  } catch {
    return {};
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body = safeJsonParse(req.body);
    const { cliente, pedido } = body || {};

    // Se você mandar "to/subject/html/text" ele usa; se não, ele tenta montar pelo pedido
    const to = String(body.to || (cliente && cliente.email) || "").trim();
    const subject =
      body.subject || (pedido?.id_pagamento ? `Pedido #${pedido.id_pagamento} confirmado` : "Pagamento Confirmado - Dynamix");

    const itensTxt = Array.isArray(pedido?.itens)
      ? pedido.itens.map((i) => i?.name || i?.title || i?.nome).filter(Boolean).join(", ")
      : "";

    const fallbackText =
      body.text ||
      `Pagamento confirmado! ✅
${cliente?.nome ? `Cliente: ${cliente.nome}\n` : ""}${cliente?.email ? `E-mail: ${cliente.email}\n` : ""}${
        pedido?.id_pagamento ? `ID Pagamento: ${pedido.id_pagamento}\n` : ""
      }${pedido?.total ? `Total: R$ ${pedido.total}\n` : ""}${itensTxt ? `Itens: ${itensTxt}\n` : ""}
Em breve enviaremos o rastreio.`;

    const fallbackHtml =
      body.html ||
      `<div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2 style="margin:0 0 8px">Pagamento confirmado ✅</h2>
        ${cliente?.nome ? `<p style="margin:0"><b>Cliente:</b> ${escapeHtml(cliente.nome)}</p>` : ""}
        ${cliente?.email ? `<p style="margin:0"><b>E-mail:</b> ${escapeHtml(cliente.email)}</p>` : ""}
        ${pedido?.id_pagamento ? `<p style="margin:0"><b>ID Pagamento:</b> ${escapeHtml(pedido.id_pagamento)}</p>` : ""}
        ${pedido?.total ? `<p style="margin:0"><b>Total:</b> R$ ${escapeHtml(pedido.total)}</p>` : ""}
        ${itensTxt ? `<p style="margin:8px 0 0"><b>Itens:</b> ${escapeHtml(itensTxt)}</p>` : ""}
        <p style="margin:12px 0 0">Em breve enviaremos o rastreio.</p>
      </div>`;

    // =========================
    // PARTE 1: Formspree (vendedor)
    // =========================
    let okVendedor = false;
    let vendedorStatus = null;
    let vendedorErr = "";

    if (cliente && pedido) {
      const mensagemFormspree = `
NOVO PEDIDO APROVADO! 🚀
CLIENTE: ${cliente.nome || "-"} (${cliente.email || "-"})
ID PAGAMENTO: ${pedido.id_pagamento || "-"}
TOTAL: R$ ${pedido.total || "-"}
ITENS: ${Array.isArray(pedido.itens) ? pedido.itens.map(i => i?.name || i?.title || i?.nome).filter(Boolean).join(", ") : "-"}
      `.trim();

      try {
        const r = await fetch(FORM_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: cliente.email,
            message: mensagemFormspree,
            subject: `Novo Pedido #${pedido.id_pagamento || ""}`.trim(),
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
    let mailerStatus = null;
    let mailerBody = "";

    // Só tenta enviar se tiver destinatário
    if (to) {
      const MS_KEY = process.env.MAILERSEND_API_KEY;
      const FROM_EMAIL = process.env.MAIL_FROM_EMAIL; // precisa ser domínio verificado no MailerSend
      const FROM_NAME = process.env.MAIL_FROM_NAME || "Dynamix";

      if (!MS_KEY || !FROM_EMAIL) {
        return res.status(500).json({
          ok: false,
          error: "Config faltando: MAILERSEND_API_KEY / MAIL_FROM_EMAIL",
          okVendedor,
          vendedorStatus,
          vendedorErr,
          okCliente: false,
        });
      }

      const payload = {
        from: { email: String(FROM_EMAIL).trim(), name: String(FROM_NAME).trim() },
        to: [{ email: to }],
        subject,
        text: fallbackText,
        html: fallbackHtml,
      };

      const resp = await fetch(MAILERSEND_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MS_KEY}`,
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      mailerStatus = resp.status;
      mailerBody = await resp.text().catch(() => "");

      // MailerSend geralmente retorna 202 Accepted quando aceitou
      if (!resp.ok) {
        console.error("MailerSend error:", mailerStatus, mailerBody);

        return res.status(mailerStatus).json({
          ok: false,
          error: "Falha ao enviar e-mail via MailerSend",
          mailerStatus,
          mailerBody, // <-- aqui costuma vir o motivo real (ex: domínio não verificado)
          okVendedor,
          vendedorStatus,
          vendedorErr,
          okCliente: false,
        });
      }

      okCliente = true;
    } else {
      // Não tinha email do cliente
      return res.status(400).json({
        ok: false,
        error: 'Destinatário ausente. Envie "cliente.email" ou "to".',
        okVendedor,
        vendedorStatus,
        vendedorErr,
        okCliente: false,
      });
    }

    return res.status(200).json({
      ok: true,
      okVendedor,
      vendedorStatus,
      vendedorErr,
      okCliente,
      mailerStatus,
      // mailerBody geralmente vem vazio no sucesso (202), mas deixo aqui por transparência:
      mailerBody,
    });
  } catch (e) {
    console.error("Erro geral /api/notificar:", e);
    return res.status(500).json({ ok: false, error: "Internal error" });
  }
}
// ========================== FIM: /api/notificar.js ==========================
