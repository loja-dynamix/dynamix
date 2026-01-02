// api/frete.js
module.exports = async (req, res) => {
    // 1. Configurações de Permissão (CORS)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  
    // --- CONFIGURE SEU CEP DE ORIGEM AQUI ---
    const CEP_ORIGEM = '05303000'; // Ex: Praça da Sé (Mude para o seu)
    // ----------------------------------------

    const { cepDestino } = req.body;
  
    if (!cepDestino) {
      return res.status(400).json({ error: 'CEP de destino obrigatório' });
    }
  
    try {
      // Códigos: 04014 = SEDEX, 04510 = PAC
      const url = `http://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx?nCdEmpresa=&sDsSenha=&sCepOrigem=${CEP_ORIGEM}&sCepDestino=${cepDestino}&nVlPeso=1&nCdFormato=1&nVlComprimento=20&nVlAltura=20&nVlLargura=20&sCdMaoPropria=n&nVlValorDeclarado=0&sCdAvisoRecebimento=n&nCdServico=04014,04510&StrRetorno=xml`;
  
      const response = await fetch(url);
      const text = await response.text();
  
      // Função simples para extrair dados do XML dos Correios sem precisar de bibliotecas pesadas
      const extract = (xml, tag) => {
        const match = xml.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`));
        return match ? match[1] : null;
      };
  
      // Como a resposta vem misturada, vamos separar Sedex e PAC manualmente (gambiarra técnica segura)
      const servicos = text.split('<cServico>');
      const resultados = [];
  
      servicos.forEach(s => {
        const codigo = extract(s, 'Codigo');
        const valor = extract(s, 'Valor');
        const prazo = extract(s, 'PrazoEntrega');
        
        if (codigo && valor) {
            resultados.push({
                nome: codigo === '04014' ? 'SEDEX' : 'PAC',
                preco: parseFloat(valor.replace('.', '').replace(',', '.')),
                prazo: prazo
            });
        }
      });
  
      return res.status(200).json(resultados);
  
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Erro ao calcular frete nos Correios' });
    }
  };