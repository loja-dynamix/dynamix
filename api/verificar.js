// api/verificar.js
module.exports = async (req, res) => {
  const { id, pedidoId } = req.query;
  const token = process.env.MP_ACCESS_TOKEN;

  try {
    // Busca prioritária pelo external_reference (ID do Pedido)
    const search = await fetch(`https://api.mercadopago.com/v1/payments/search?external_reference=${pedidoId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const searchData = await search.json();

    if (searchData.results && searchData.results.length > 0) {
      const pagamento = searchData.results[0];
      return res.status(200).json({ status: pagamento.status, id_real: pagamento.id });
    }

    // Se não achou na busca, tenta pelo ID direto
    const resId = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const dataId = await resId.json();
    return res.status(200).json({ status: dataId.status });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
