// api/verificar.js
module.exports = async (req, res) => {
  // Configuração padrão da Vercel
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { id } = req.query; // Pega o ID do pagamento da URL
  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

  if (!id || !ACCESS_TOKEN) {
    return res.status(400).json({ error: 'ID ou Token faltando' });
  }

  try {
    // PERGUNTA AO MERCADO PAGO O STATUS REAL EM TEMPO REAL
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      }
    });

    const data = await response.json();

    // Retorna para o seu site o status oficial (approved, pending, rejected)
    return res.status(200).json({ 
      status: data.status, 
      status_detail: data.status_detail,
      payment_type: data.payment_type_id
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};