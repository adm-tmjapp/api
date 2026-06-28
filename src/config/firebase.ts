import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

function loadServiceAccount() {
  const envRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (envRaw) return JSON.parse(envRaw);

  const candidates = [
    path.resolve(__dirname, "firebaseServiceAccount.json"),
    path.resolve(process.cwd(), "src/config/firebaseServiceAccount.json"),
    path.resolve(process.cwd(), "dist/config/firebaseServiceAccount.json"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return JSON.parse(fs.readFileSync(candidate, "utf-8"));
    }
  }

  throw new Error(
    "Credenciais do Firebase não encontradas. Configure FIREBASE_SERVICE_ACCOUNT_JSON ou firebaseServiceAccount.json.",
  );
}

const serviceAccount = loadServiceAccount();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL || process.env.FIREBASE_DB_URL,
  });
}

export default admin;
