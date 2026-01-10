module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { id, pedidoId } = req.query; 
  const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

  try {
    // TENTATIVA 1: Buscar pelo ID direto (funciona se for o ID da transação)
    let response = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
    });
    let data = await response.json();

    // TENTATIVA 2: Se a primeira falhou ou não achou, busca pelo ID do seu Pedido
    if ((!data.status || data.status === 404) && pedidoId) {
      const searchRes = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${pedidoId}`, {
        headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}` }
      });
      const searchData = await searchRes.json();
      
      if (searchData.results && searchData.results.length > 0) {
        data = searchData.results[0]; // Pega o pagamento mais recente vinculado a esse pedido
      }
    }

    return res.status(200).json({ 
      status: data.status, // approved, pending, etc
      id_real: data.id      // O ID real da transação para você atualizar seu banco
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
