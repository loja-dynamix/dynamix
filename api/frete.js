module.exports = async (req, res) => {
  // ✅ CORS
  res.setHeader("Access-Control-Allow-Credentials", true);
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  // --- CONFIGURAÇÃO: CEP DE ORIGEM ---
  const CEP_ORIGEM = "01001000"; // <-- MUDE para o seu
  // -----------------------------------

  const { cepDestino } = req.body;

  if (!cepDestino) return res.status(400).json({ error: "CEP obrigatório" });

  const cepLimpo = String(cepDestino).replace(/\D/g, "");
  const origemLimpo = String(CEP_ORIGEM).replace(/\D/g, "");

  if (cepLimpo.length !== 8)
    return res
      .status(400)
      .json({ error: "CEP inválido (deve ter 8 dígitos)" });

  // ✅ medidas padrão (você pode ajustar depois por produto/carrinho)
  const pacote = {
    weight: 1.0,   // kg
    length: 20,    // cm
    width: 20,     // cm
    height: 20     // cm
  };

  // =========================
  // 1) COTAÇÃO CORREIOS
  // =========================
  async function cotarCorreios() {
    try {
      const payload = {
        cepOrigem: origemLimpo,
        cepDestino: cepLimpo,
        peso: pacote.weight,
        formato: 1,
        comprimento: pacote.length,
        altura: pacote.height,
        largura: pacote.width,
        diametro: 0,
        tipoServico: "04510" // PAC
      };

      const responseReal = await fetch(
        "https://brasilapi.com.br/api/correios/v1/preco/prazo",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );

      if (!responseReal.ok) throw new Error("Correios instável");

      const data = await responseReal.json();

      return [
        {
          origem: "correios",
          nome: "PAC (Correios)",
          preco: Number(data.valor),
          prazo: data.prazoEntrega
        },
        {
          origem: "correios",
          nome: "SEDEX (Estimado)",
          preco: Number(data.valor) * 1.4,
          prazo: Math.max(1, data.prazoEntrega - 3)
        }
      ];
    } catch (e) {
      // fallback por UF (igual seu plano B)
      try {
        const responseViaCep = await fetch(
          `https://viacep.com.br/ws/${cepLimpo}/json/`
        );
        const dataViaCep = await responseViaCep.json();
        if (dataViaCep.erro) throw new Error("CEP não existe");

        const uf = dataViaCep.uf;

        let precoFrete = 35.0;
        let prazoDias = 8;

        const sudeste = ["SP", "RJ", "MG", "ES"];
        const sul = ["PR", "SC", "RS"];

        if (uf === "SP") {
          precoFrete = 18.9;
          prazoDias = 3;
        } else if (sudeste.includes(uf)) {
          precoFrete = 24.9;
          prazoDias = 5;
        } else if (sul.includes(uf)) {
          precoFrete = 28.9;
          prazoDias = 6;
        }

        return [
          {
            origem: "tabela",
            nome: "Transportadora Econômica",
            preco: precoFrete,
            prazo: `${prazoDias}-${prazoDias + 4}`
          },
          {
            origem: "tabela",
            nome: "Entrega Expressa",
            preco: precoFrete * 1.5,
            prazo: `${Math.max(1, prazoDias - 2)}-${prazoDias}`
          }
        ];
      } catch (err) {
        return [];
      }
    }
  }

  // =========================
  // 2) COTAÇÃO MELHOR ENVIO
  // =========================
  async function cotarMelhorEnvio() {
    const token = process.env.MELHORENVIO_TOKEN;
    if (!token) return [];

    const baseUrl = process.env.MELHORENVIO_BASE_URL || "https://melhorenvio.com.br";
    const url = `${baseUrl}/api/v2/me/shipment/calculate`;

    try {
      const payload = {
        from: { postal_code: origemLimpo },
        to: { postal_code: cepLimpo },
        package: {
          weight: pacote.weight,
          length: pacote.length,
          width: pacote.width,
          height: pacote.height
        }
      };

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Bearer ${token}`,
          // User-Agent é recomendado em várias APIs
          "User-Agent": "Dynamix (frete@dynamixoficial.com.br)"
        },
        body: JSON.stringify(payload)
      });

      const data = await resp.json();

      // Normaliza retorno (pode vir array direto)
      const lista = Array.isArray(data) ? data : (data?.data || []);

      if (!Array.isArray(lista) || lista.length === 0) return [];

      // ✅ tenta puxar só LOGGI
      const soLoggi = lista.filter((item) => {
        const companyName = (item?.company?.name || "").toLowerCase();
        const serviceName = (item?.name || "").toLowerCase();
        return companyName.includes("loggi") || serviceName.includes("loggi");
      });

      const escolhidas = soLoggi.length > 0 ? soLoggi : lista;

      return escolhidas.map((item) => {
        const companyName = item?.company?.name || "Melhor Envio";
        const nomeServico = item?.name || "Serviço";
        const preco = Number(item?.price || item?.custom_price || 0);

        // Prazo pode vir em formatos diferentes
        const prazoMin = item?.delivery_range?.min ?? item?.delivery_time ?? null;
        const prazoMax = item?.delivery_range?.max ?? null;

        let prazoTexto = null;
        if (prazoMin != null && prazoMax != null) prazoTexto = `${prazoMin}-${prazoMax}`;
        else if (prazoMin != null) prazoTexto = String(prazoMin);

        return {
          origem: "melhorenvio",
          transportadora: companyName,
          nome: `${companyName} - ${nomeServico}`,
          preco,
          prazo: prazoTexto
        };
      }).filter((x) => x.preco > 0);
    } catch (e) {
      return [];
    }
  }

  // =========================
  // RESPOSTA FINAL
  // =========================
  const [correios, melhorEnvio] = await Promise.all([
    cotarCorreios(),
    cotarMelhorEnvio()
  ]);

  const resultadoFinal = [
    ...correios,
    ...melhorEnvio
  ];

  if (resultadoFinal.length === 0) {
    return res.status(400).json({
      error: "Não foi possível calcular o frete agora. Tente novamente."
    });
  }

  return res.status(200).json(resultadoFinal);
};
