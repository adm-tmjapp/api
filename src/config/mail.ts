import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export const tmjMailIdentity = {
  name: process.env.MAIL_FROM_NAME || "TMJApp",
  address: "noreply@tmjapp.com.br",
  replyTo: process.env.MAIL_REPLY_TO || "suporte@tmjapp.com.br",
};

export const tmjMailSubjects = {
  emailVerification: "TMJApp — Confirme seu e-mail",
  passwordReset: "TMJApp — Código para recuperar sua senha",
  passwordChanged: "TMJApp — Sua senha foi alterada",
} as const;

export const mailTransporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT || 587),
  secure: Number(process.env.MAIL_PORT) === 465,
  requireTLS: Number(process.env.MAIL_PORT || 587) === 587,
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 15_000,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
});
