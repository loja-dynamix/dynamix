// api/notificar.js
module.exports = async (req, res) => {
    // Permissões
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') { res.status(200).end(); return; }

    const { cliente, pedido, entrega } = req.body;

    if (!cliente || !pedido) return res.status(400).json({ error: 'Dados incompletos' });

    // Monta a mensagem bonita
    const mensagem = `
    NOVO PEDIDO APROVADO! 🚀
    
    CLIENTE:
    Nome: ${cliente.nome}
    Email: ${cliente.email}
    CPF: ${cliente.cpf}
    Telefone: ${cliente.telefone}

    ENTREGA (${entrega.tipo}):
    CEP: ${entrega.cep}
    Rua: ${entrega.rua}, ${entrega.numero}
    Bairro: ${entrega.bairro}
    Cidade: ${entrega.cidade} - ${entrega.estado}
    Comp: ${entrega.complemento || '-'}

    PEDIDO:
    ID Pagamento: ${pedido.id_pagamento}
    Total: R$ ${pedido.total.toFixed(2)}
    Frete Escolhido: ${pedido.frete_nome} (R$ ${pedido.frete_valor})
    
    ITENS:
    ${pedido.itens.map(i => `- ${i.name} (R$ ${i.price})`).join('\n')}
    `;

    try {
        // Envia para o Formspree
        const response = await fetch('https://formspree.io/f/xykznlnr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: cliente.email,
                message: mensagem,
                subject: `Novo Pedido #${pedido.id_pagamento} - ${cliente.nome}`
            })
        });

        if (response.ok) return res.status(200).json({ success: true });
        else throw new Error("Erro Formspree");

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};