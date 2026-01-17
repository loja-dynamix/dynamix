// /api/bemvindo.js
const nodemailer = require("nodemailer");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Apenas POST" });
    }

    const { to, nome } = req.body;

    if (!to) {
      return res.status(400).json({ ok: false, error: "E-mail do cliente (to) não veio." });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.zoho.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.ZOHO_EMAIL,
        pass: process.env.ZOHO_APP_PASSWORD,
      },
    });

    const primeiroNome = (nome || "Cliente").split(" ")[0];

    // ✅ E-mail HTML bonitinho (boas-vindas)
    const html = `
      <div style="background:#f6f6f6;padding:30px 0;font-family:Arial,sans-serif;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.08);">
          
          <div style="background:linear-gradient(90deg,#ffc30d,#ff8600);padding:26px;text-align:center;">
            <img src="https://i.imgur.com/PxWRD9i.png" alt="Dynamix" style="height:62px;margin-bottom:10px;object-fit:contain;" />
            <h1 style="margin:0;color:#000;font-size:22px;font-weight:900;">
              Seja bem-vindo(a), ${primeiroNome}! 🎉
            </h1>
            <p style="margin:10px 0 0;color:#111;font-size:13px;font-weight:700;">
              Sua conta na Dynamix foi criada com sucesso ✅
            </p>
          </div>

          <div style="padding:24px 26px;color:#111;">
            <p style="margin:0 0 10px;font-size:14px;line-height:1.5;">
              Agora você faz parte do <b>Time Dynamix</b> 💪🔥  
              Preparamos algumas sugestões para você começar com o pé direito:
            </p>

            <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px;">
              <a href="https://dynamixoficial.com.br/produtos.html"
                 style="flex:1;min-width:170px;text-decoration:none;background:#000;color:#fff;padding:12px 14px;border-radius:12px;font-weight:900;text-align:center;">
                 🛍️ Ver Produtos
              </a>

              <a href="https://dynamixoficial.com.br/produtos.html?categoria=Combos"
                 style="flex:1;min-width:170px;text-decoration:none;background:#ff8600;color:#000;padding:12px 14px;border-radius:12px;font-weight:900;text-align:center;">
                 📦 Ver Combos
              </a>

              <a href="https://dynamixoficial.com.br/produtos.html?categoria=Emagrecimento"
                 style="flex:1;min-width:170px;text-decoration:none;background:#ffc30d;color:#000;padding:12px 14px;border-radius:12px;font-weight:900;text-align:center;">
                 🔥 Emagrecimento
              </a>
            </div>

            <div style="margin-top:18px;background:#fff7e6;border:1px solid #ffe2a8;padding:14px;border-radius:12px;">
              <p style="margin:0;font-size:13px;line-height:1.5;">
                ✅ <b>Dica:</b> Entre no seu perfil e confirme seu endereço para o frete ficar automático.<br/>
                Se precisar de ajuda, fale com a gente: <b>contato@dynamixoficial.com.br</b>
              </p>
            </div>

            <div style="margin-top:18px;text-align:center;">
              <a href="https://dynamixoficial.com.br/"
                 style="display:inline-block;text-decoration:none;background:linear-gradient(90deg,#ffc30d,#ff8600);color:#000;padding:14px 18px;border-radius:14px;font-weight:900;">
                ✅ Acessar a Dynamix Agora
              </a>
            </div>

            <hr style="border:none;border-top:1px solid #eee;margin:22px 0;"/>

            <p style="margin:0;color:#666;font-size:11px;line-height:1.4;text-align:center;">
              Você recebeu este e-mail porque criou uma conta em <b>DynamixOficial.com.br</b>.<br/>
              Se não foi você, ignore esta mensagem.
            </p>
          </div>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `Dynamix <${process.env.ZOHO_EMAIL}>`,
      to,
      subject: "🎉 Bem-vindo(a) à Dynamix! Sua conta foi criada ✅",
      html,
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Erro /api/bemvindo:", err);
    return res.status(500).json({ ok: false, error: "Falha ao enviar e-mail de boas-vindas" });
  }
};
