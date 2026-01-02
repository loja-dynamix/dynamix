// api/frete.js
module.exports = async (req, res) => {
    // 1. Configuração de permissões (CORS)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
    if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  
    // --- IMPORTANTE: COLOQUE SEU CEP DE ORIGEM AQUI ---
    const CEP_ORIGEM = '01001000'; // Exemplo: Praça da Sé (Mude para o seu CEP)
    // --------------------------------------------------

    const { cepDestino } = req.body;
  
    if (!cepDestino) {
      return res.status(400).json({ error: 'CEP obrigatório' });
    }
  
    try {
      // Códigos: 04014 = SEDEX, 04510 = PAC
      const url = `http://ws.correios.com.br/calculador/CalcPrecoPrazo.aspx?nCdEmpresa=&sDsSenha=&sCepOrigem=${CEP_ORIGEM}&sCepDestino=${cepDestino}&nVlPeso=1&nCdFormato=1&nVlComprimento=20&nVlAltura=20&nVlLargura=20&sCdMaoPropria=n&nVlValorDeclarado=0&sCdAvisoRecebimento=n&nCdServico=04014,04510&StrRetorno=xml`;
  
      // Faz a chamada aos Correios
      const response = await fetch(url);
      const xmlText = await response.text();
  
      // Pequena função para ler o XML dos Correios sem precisar de bibliotecas pesadas
      const getTagValue = (xml, tag) => {
        const regex = new RegExp(`<${tag}>(.*?)<\/${tag}>`);
        const match = xml.match(regex);
        return match ? match[1] : null;
      };

      // Separamos os serviços (PAC e SEDEX)
      // A resposta dos correios vem tudo junto, precisamos separar
      const servicos = xmlText.split('<cServico>');
      const opcoes = [];

      servicos.forEach(servico => {
          const codigo = getTagValue(servico, 'Codigo');
          const valorStr = getTagValue(servico, 'Valor');
          const prazo = getTagValue(servico, 'PrazoEntrega');
          const erro = getTagValue(servico, 'Erro');

          // Se tiver valor e não tiver erro grave (0 ou nulo)
          if (valorStr && erro === '0') {
              const valorNumerico = parseFloat(valorStr.replace('.', '').replace(',', '.'));
              
              if (valorNumerico > 0) {
                  opcoes.push({
                      nome: codigo === '04014' ? 'SEDEX' : 'PAC',
                      preco: valorNumerico,
                      prazo: prazo
                  });
              }
          }
      });

      if (opcoes.length === 0) {
          // Se não retornou nada, vamos criar um "Frete Fixo" de fallback para não travar a venda
          return res.status(200).json([
              { nome: 'Envio Padrão', preco: 25.00, prazo: '5-10' }
          ]);
      }
  
      return res.status(200).json(opcoes);
  
    } catch (error) {
      console.error("Erro Correios:", error);
      return res.status(500).json({ error: 'Erro ao conectar com Correios' });
    }
  };
