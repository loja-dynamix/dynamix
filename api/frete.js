// ATENÇÃO: Usamos 'http' porque o webservice dos Correios é antigo e não usa SSL
const http = require('http');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    const { cepDestino } = req.body;

    // --- SEU CEP DE ORIGEM (Mude para o real) ---
    const CEP_ORIGEM = '01001000'; 
    // --------------------------------------------

    // PACOTE PADRÃO (Para estimativa)
    // Se quiser precisão, precisaremos somar isso no frontend depois
    const PESO = '1';       // 1kg
    const FORMATO = '1';    // 1 = Caixa/Pacote
    const COMPRIMENTO = '20';
    const ALTURA = '20';
    const LARGURA = '20';
    const DIAMETRO = '0';

    if (!cepDestino || cepDestino.length !== 8) {
        return res.status(400).json({ error: 'CEP inválido' });
    }

    // URL oficial dos Correios (sem https)
    // 04014 = SEDEX, 04510 = PAC
    const url = `http://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx?nCdEmpresa=&sDsSenha=&sCepOrigem=${CEP_ORIGEM}&sCepDestino=${cepDestino}&nVlPeso=${PESO}&nCdFormato=${FORMATO}&nVlComprimento=${COMPRIMENTO}&nVlAltura=${ALTURA}&nVlLargura=${LARGURA}&nVlDiametro=${DIAMETRO}&sCdMaoPropria=n&nVlValorDeclarado=0&sCdAvisoRecebimento=n&nCdServico=04014,04510&StrRetorno=xml`;

    const consultar = () => {
        return new Promise((resolve, reject) => {
            const req = http.get(url, (resp) => {
                let data = '';
                resp.on('data', (chunk) => { data += chunk; });
                resp.on('end', () => { resolve(data); });
            });

            req.on('error', (err) => { reject(err); });
            req.setTimeout(5000, () => { // 5 segundos de limite
                req.destroy();
                reject(new Error("Timeout Correios"));
            });
        });
    };

    try {
        const xml = await consultar();

        // Função manual para ler o XML
        const extract = (xmlString, tag) => {
            const match = xmlString.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`));
            return match ? match[1] : null;
        };

        const servicos = xml.split('<cServico>');
        const resultados = [];

        servicos.forEach(s => {
            const codigo = extract(s, 'Codigo');
            const valor = extract(s, 'Valor');
            const prazo = extract(s, 'PrazoEntrega');
            const erro = extract(s, 'Erro'); // 0 = ok

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
            // Se os correios responderem mas sem serviços válidos
            console.log("Correios respondeu vazio:", xml);
            throw new Error("Sem serviços disponíveis");
        }

    } catch (error) {
        console.error("Erro na API de Frete:", error.message);
        // Fallback apenas se der erro real
        return res.status(200).json([
            { nome: 'Frete Fixo (Site)', preco: 25.00, prazo: '5-10' },
            { nome: 'Expresso (Site)', preco: 45.90, prazo: '2-4' }
        ]);
    }
};
