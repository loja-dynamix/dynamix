module.exports = async (req, res) => {
  // 1. Configuração de CORS (Para permitir que seu site fale com o backend)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Se for apenas uma verificação do navegador (OPTIONS), responde OK e para.
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 2. Apenas aceita método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 3. Pega o Token das variáveis de ambiente
  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

  if (!ACCESS_TOKEN) {
    console.error("Erro: Token do Mercado Pago não encontrado na Vercel.");
    return res.status(500).json({ error: 'Servidor mal configurado (Token ausente)' });
  }

  const { items, payer } = req.body;

  try {
    // 4. Chamada para o Mercado Pago
    // Nota: O 'fetch' nativo precisa do Node 18+. Se der erro, a Vercel precisa estar no Node 18 ou 20.
    const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items,
        payer,
        back_urls: {
          success: req.headers.origin || "https://dynamix-tau.vercel.app",
          failure: req.headers.origin || "https://dynamix-tau.vercel.app",
          pending: req.headers.origin || "https://dynamix-tau.vercel.app"
        },
        auto_return: "approved",
      })
    });

    const data = await response.json();

    if (data.init_point) {
      return res.status(200).json({ init_point: data.init_point });
    } else {
      console.error("Erro MP:", data);
      return res.status(400).json({ error: 'Erro ao gerar link', details: data });
    }

  } catch (error) {
    console.error("Erro Interno:", error);
    return res.status(500).json({ error: error.message });
  }
};
