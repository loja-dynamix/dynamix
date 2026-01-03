module.exports = async (req, res) => {
    // 1. Permissões
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    // --- SEU CEP DE ORIGEM (Mude para o seu) ---
    const CEP_ORIGEM = '01001000'; 
    // -------------------------------------------

    try {
        const { cepDestino } = req.body;

        if (!cepDestino) throw new Error('CEP não informado');

        // --- CORREÇÃO PRINCIPAL: LIMPEZA DO CEP ---
        // Remove tudo que não for número (traços, pontos, espaços)
        const cepLimpo = cepDestino.replace(/\D/g, '');
        const origemLimpo = CEP_ORIGEM.replace(/\D/g, '');

        if (cepLimpo.length !== 8) throw new Error('CEP deve ter 8 dígitos');

        // Configuração do pacote padrão (1kg)
        const payload = {
            cepOrigem: origemLimpo,
            cepDestino: cepLimpo,
            peso: 1,
            formato: 1,
            comprimento: 20,
            altura: 20,
            largura: 20,
            diametro: 0
        };

        // Chama BrasilAPI (SEDEX e PAC)
        // Usamos Promise.allSettled para que se um falhar, o outro ainda tente funcionar
        const calls = await Promise.allSettled([
            fetch('https://brasilapi.com.br/api/correios/v1/preco/prazo', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, tipoServico: '04014' }) // SEDEX
            }),
            fetch('https://brasilapi.com.br/api/correios/v1/preco/prazo', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...payload, tipoServico: '04510' }) // PAC
            })
        ]);

        const resultados = [];

        // Processa SEDEX
        if (calls[0].status === 'fulfilled' && calls[0].value.ok) {
            const data = await calls[0].value.json();
            resultados.push({ nome: 'SEDEX', preco: parseFloat(data.valor), prazo: data.prazoEntrega });
        }

        // Processa PAC
        if (calls[1].status === 'fulfilled' && calls[1].value.ok) {
            const data = await calls[1].value.json();
            resultados.push({ nome: 'PAC', preco: parseFloat(data.valor), prazo: data.prazoEntrega });
        }

        // Se não conseguiu nenhum, lança erro para cair no catch
        if (resultados.length === 0) {
            // Tenta pegar a mensagem de erro da API para te mostrar
            const erroMsg = calls[0].status === 'fulfilled' ? await calls[0].value.text() : 'Falha na conexão';
            console.error("Erro BrasilAPI:", erroMsg);
            throw new Error("Não foi possível calcular o frete para este CEP (Serviço indisponível ou CEP inválido).");
        }

        return res.status(200).json(resultados);

    } catch (error) {
        console.error("Erro Fatal:", error.message);
        
        // MODO DIAGNÓSTICO: 
        // Retorna o erro real para o frontend exibir (em vez do valor fixo)
        // Assim você saberá se é "CEP Inválido" ou "Erro no Servidor"
        return res.status(400).json({ 
            error: error.message,
            fallback: true // Avisa que deu erro
        });
    }
};
