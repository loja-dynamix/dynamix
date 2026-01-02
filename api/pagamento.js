// api/pagamento.js
module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
    if (req.method !== 'POST') { return res.status(405).json({ error: 'Method Not Allowed' }); }
  
    const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    if (!ACCESS_TOKEN) return res.status(500).json({ error: 'Token ausente' });
  
    // Agora recebemos o "shipment_cost" (custo do frete)
    const { items, payer, shipment_cost } = req.body;
  
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
          // ADICIONA O CUSTO DO FRETE AQUI
          shipments: {
            cost: shipment_cost || 0,
            mode: 'not_specified'
          },
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
        return res.status(400).json({ error: 'Erro MP', details: data });
      }
  
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  };
