const https = require('https');

module.exports = async (req, res) => {
    // 1. Configuração CORS (Para aceitar qualquer origem)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Responde rápido se for apenas verificação do navegador
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // --- SEU CEP DE ORIGEM ---
    const CEP_ORIGEM = '01001000'; 
    // -------------------------

    const { cepDestino } = req.body;

    // Função de Fallback (Plano B): Se tudo der errado, mostre isso
    const retornarFreteFixo = () => {
        console.log("Usando Frete Fixo de emergência");
        return res.status(200).json([
            { nome: 'Entrega Padrão', preco: 25.00, prazo: '5-10' },
            { nome: 'Entrega Expressa', preco: 45.90, prazo: '2-4' }
        ]);
    };

    if (!cepDestino) {
        return res.status(400).json({ error: 'CEP faltando' });
    }

    // Limpa o CEP (deixa só números)
    const cepLimpo = cepDestino.replace(/\D/g, '');

    if (cepLimpo.length !== 8) {
        return res.status(400).json({ error: 'CEP inválido' });
    }

    const url = `https://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx?nCdEmpresa=&sDsSenha=&sCepOrigem=${CEP_ORIGEM}&sCepDestino=${cepLimpo}&nVlPeso=1&nCdFormato=1&nVlComprimento=20&nVlAltura=20&nVlLargura=20&sCdMaoPropria=n&nVlValorDeclarado=0&sCdAvisoRecebimento=n&nCdServico=04014,04510&StrRetorno=xml`;

    // Usamos uma Promise para envolver a requisição antiga do Node
    const consultarCorreios = () => {
        return new Promise((resolve, reject) => {
            const request = https.get(url, (response) => {
                let data = '';

                // Recebe os pedacinhos dos dados
                response.on('data', (chunk) => {
                    data += chunk;
                });

                // Quando terminar de receber tudo
                response.on('end', () => {
                    resolve(data);
                });
            });

            request.on('error', (err) => {
                reject(err);
            });
            
            // Define um timeout de 4 segundos. Se Correios não responder, cancela.
            request.setTimeout(4000, () => {
                request.destroy();
                reject(new Error("Timeout Correios"));
            });
        });
    };

    try {
        const xmlText = await consultarCorreios();

        // Função "manual" para ler XML (sem bibliotecas)
        const extract = (xml, tag) => {
            const regex = new RegExp(`<${tag}>(.*?)<\/${tag}>`);
            const match = xml.match(regex);
            return match ? match[1] : null;
        };

        const servicos = xmlText.split('<cServico>');
        const resultados = [];

        servicos.forEach(s => {
            const codigo = extract(s, 'Codigo');
            const valor = extract(s, 'Valor');
            const prazo = extract(s, 'PrazoEntrega');
            const erro = extract(s, 'Erro');

            // 04014 = SEDEX, 04510 = PAC
            if (valor && (erro === '0' || erro === '010' || !erro)) {
                const precoFloat = parseFloat(valor.replace('.', '').replace(',', '.'));
                if (precoFloat > 0) {
                    resultados.push({
                        nome: codigo === '04014' ? 'SEDEX' : 'PAC',
                        preco: precoFloat,
                        prazo: prazo
                    });
                }
            }
        });

        if (resultados.length > 0) {
            return res.status(200).json(resultados);
        } else {
            // Se os Correios responderam mas não deram preço, usa o fixo
            return retornarFreteFixo();
        }

    } catch (error) {
        // Se deu erro de conexão, timeout ou qualquer outra coisa
        console.error("Erro na API:", error.message);
        return retornarFreteFixo();
    }
};
