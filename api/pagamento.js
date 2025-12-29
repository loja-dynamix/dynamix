// api/pagamento.js
export default async function handler(req, res) {
  // Apenas aceita método POST (envio de dados)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Pega o Token que estará escondido nas configurações da Vercel
  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN; 

  if (!ACCESS_TOKEN) {
    return res.status(500).json({ error: 'Token não configurado no servidor' });
  }

  const { items, payer } = req.body;

  try {
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
          success: req.headers.origin, // Volta para o site atual
          failure: req.headers.origin,
          pending: req.headers.origin
        },
        auto_return: "approved",
      })
    });

    const data = await response.json();

    if (data.init_point) {
      return res.status(200).json({ init_point: data.init_point });
    } else {
      return res.status(400).json({ error: 'Erro ao gerar link', details: data });
    }

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}