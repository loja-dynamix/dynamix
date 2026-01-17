// =============================
// INÍCIO - /api/checkUser.js
// =============================
const admin = require("firebase-admin");

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n").trim();

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

module.exports = async (req, res) => {
  try {
    const email = String(req.query.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(400).json({ exists: false, message: "Email vazio" });
    }

    // ✅ Verifica se existe no Firebase Auth
    await admin.auth().getUserByEmail(email);

    return res.status(200).json({ exists: true });
  } catch (err) {
    // Se não existe:
    if (err.code === "auth/user-not-found") {
      return res.status(200).json({ exists: false });
    }

    return res.status(500).json({
      exists: false,
      error: "Erro interno ao verificar usuário",
    });
  }
};
// =============================
// FIM - /api/checkUser.js
// =============================
