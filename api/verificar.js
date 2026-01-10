// api/verificar.js (NA VERCEL)
module.exports = async (req, res) => {
  const { id, pedidoId } = req.query; // AGORA ELE LÊ OS DOIS
  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

  try {
    // 1. Tenta buscar pelo ID de pagamento (caso já seja o ID real)
    let response = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });
    let data = await response.json();

    // 2. SE NÃO ACHOU (404), busca pelo seu ID do pedido (external_reference)
    if ((!data.status || data.status === 404) && pedidoId) {
      const searchRes = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${pedidoId}`, {
        headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
      });
      const searchData = await searchRes.json();
      
      if (searchData.results && searchData.results.length > 0) {
        data = searchData.results[0]; // Pega o pagamento real que o MP achou vinculado ao seu ID
      }
    }

    // Retorna para o seu HTML o status correto
    return res.status(200).json({ 
      status: data.status, 
      id_real: data.id 
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
