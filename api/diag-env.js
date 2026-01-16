export default function handler(req, res) {
  const pick = (k) => (process.env[k] ? "OK" : "MISSING");

  res.status(200).json({
    node: process.version,
    vercelEnv: process.env.VERCEL_ENV || null,   // "production" | "preview" | "development"
    vercelUrl: process.env.VERCEL_URL || null,
    has: {
      MAILERSEND_API_KEY: pick("MAILERSEND_API_KEY"),
      MAIL_FROM_EMAIL: pick("MAIL_FROM_EMAIL"),
      MAIL_FROM_NAME: pick("MAIL_FROM_NAME"),
    },
    // só para confirmar o nome exato (não mostra valores)
    allMailKeys: Object.keys(process.env).filter((k) => k.includes("MAIL")).sort(),
  });
}
