module.exports = async (req, res) => {
    // 1. Permissões (CORS)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    // --- CONFIGURAÇÃO: SEU CEP DE ORIGEM ---
    const CEP_ORIGEM = '01001000'; // Mude para o seu
    // ---------------------------------------

    const { cepDestino } = req.body;

    // Limpeza básica
    if (!cepDestino) return res.status(400).json({ error: 'CEP obrigatório' });
    const cepLimpo = cepDestino.replace(/\D/g, '');
    const origemLimpo = CEP_ORIGEM.replace(/\D/g, '');

    if (cepLimpo.length !== 8) return res.status(400).json({ error: 'CEP inválido (deve ter 8 dígitos)' });

    try {
        // TENTATIVA 1: BrasilAPI (Correios Real)
        const payload = {
            cepOrigem: origemLimpo,
            cepDestino: cepLimpo,
            peso: 1, formato: 1, comprimento: 20, altura: 20, largura: 20, diametro: 0,
            tipoServico: '04510' // PAC
        };

        // Tenta pegar o PAC primeiro (mais estável)
        const responseReal = await fetch('https://brasilapi.com.br/api/correios/v1/preco/prazo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (responseReal.ok) {
            const data = await responseReal.json();
            // Se funcionou, retorna PAC e Simula um SEDEX (PAC + 40% aprox)
            return res.status(200).json([
                { nome: 'PAC (Correios)', preco: parseFloat(data.valor), prazo: data.prazoEntrega },
                { nome: 'SEDEX (Correios)', preco: parseFloat(data.valor) * 1.4, prazo: Math.max(1, data.prazoEntrega - 3) }
            ]);
        }
        
        // Se a resposta não foi OK, forçamos um erro para cair no "catch" abaixo
        throw new Error("Correios instável");

    } catch (erroApi) {
        console.error("Falha nos Correios, ativando plano B:", erroApi.message);

        // TENTATIVA 2: PLANO B (Tabela por Estado)
        try {
            // Descobre o Estado (UF) do cliente usando o ViaCEP (que nunca cai)
            const responseViaCep = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
            const dataViaCep = await responseViaCep.json();

            if (dataViaCep.erro) throw new Error("CEP não existe");

            const uf = dataViaCep.uf;
            
            // --- TABELA DE PREÇOS FIXOS POR ESTADO ---
            // Você pode editar os valores abaixo conforme sua necessidade
            let precoFrete = 35.00; // Valor padrão (Norte/Nordeste/Centro-Oeste)
            let prazoDias = 8;

            const sudeste = ['SP', 'RJ', 'MG', 'ES'];
            const sul = ['PR', 'SC', 'RS'];

            if (uf === 'SP') { 
                precoFrete = 18.90; prazoDias = 3; // Frete local mais barato
            } else if (sudeste.includes(uf)) {
                precoFrete = 24.90; prazoDias = 5;
            } else if (sul.includes(uf)) {
                precoFrete = 28.90; prazoDias = 6;
            }

            // Retorna o frete calculado pela tabela
            return res.status(200).json([
                { nome: 'Transportadora Econômica', preco: precoFrete, prazo: `${prazoDias}-${prazoDias + 4}` },
                { nome: 'Entrega Expressa', preco: precoFrete * 1.5, prazo: `${Math.max(1, prazoDias - 2)}-${prazoDias}` }
            ]);

        } catch (erroFatal) {
            // Se até o ViaCEP falhar (o que é muito raro), retorna erro para o cliente digitar o CEP de novo
            return res.status(400).json({ error: 'Não foi possível localizar este CEP. Verifique se digitou corretamente.' });
        }
    }
};
