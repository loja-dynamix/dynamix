module.exports = async (req, res) => {
    // 1. Configuração de permissões (CORS)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    // --- SEU CEP DE ORIGEM (Mude para o seu real) ---
    const CEP_ORIGEM = '01001000'; 
    // ------------------------------------------------

    const { cepDestino } = req.body;

    if (!cepDestino || cepDestino.length !== 8) {
        return res.status(400).json({ error: 'CEP inválido' });
    }

    try {
        // Vamos consultar SEDEX (04014) e PAC (04510) separadamente
        // A BrasilAPI é rápida, então chamamos as duas ao mesmo tempo.
        
        // Configuração do pacote padrão (1kg, caixa pequena)
        const payloadPadrao = {
            cepOrigem: CEP_ORIGEM,
            cepDestino: cepDestino,
            peso: 1,
            formato: 1,
            comprimento: 20,
            altura: 20,
            largura: 20,
            diametro: 0
        };

        // Faz as duas chamadas (SEDEX e PAC) em paralelo
        const [resSedex, resPac] = await Promise.all([
            fetch('https://brasilapi.com.br/api/correios/v1/preco/prazo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payloadPadrao, tipoServico: '04014' })
            }),
            fetch('https://brasilapi.com.br/api/correios/v1/preco/prazo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payloadPadrao, tipoServico: '04510' })
            })
        ]);

        const resultados = [];

        // Processa SEDEX
        if (resSedex.ok) {
            const data = await resSedex.json();
            resultados.push({
                nome: 'SEDEX',
                preco: parseFloat(data.valor),
                prazo: data.prazoEntrega
            });
        }

        // Processa PAC
        if (resPac.ok) {
            const data = await resPac.json();
            resultados.push({
                nome: 'PAC',
                preco: parseFloat(data.valor),
                prazo: data.prazoEntrega
            });
        }

        // Se conseguiu pelo menos um frete, retorna
        if (resultados.length > 0) {
            return res.status(200).json(resultados);
        } else {
            throw new Error("Nenhum frete encontrado na BrasilAPI");
        }

    } catch (error) {
        console.error("Erro BrasilAPI:", error);
        
        // --- ULTIMO RECURSO ---
        // Se a BrasilAPI cair, usamos o frete fixo para não travar a venda
        return res.status(200).json([
            { nome: 'Frete Fixo', preco: 25.00, prazo: '5-10' },
            { nome: 'Entrega Rápida', preco: 45.00, prazo: '2-4' }
        ]);
    }
};
