import User from "../models/User";
import { generateVerificationCode } from "../utils/generateCode";
import { mailTransporter } from "../config/mail";

export class EmailService {
  /**
   * Envia código de verificação por e-mail
   */
  static async sendVerificationCode(userId: string): Promise<void> {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    const code = generateVerificationCode(6);

    user.emailValidation = {
      email: user.email,
      code,
      status: "pending",
      sentAt: new Date(),
    };

    await user.save();

    await mailTransporter.sendMail({
      from: process.env.MAIL_FROM,
      to: user.email,
      subject: "Código de verificação - TMJ",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Confirmação de E-mail</h2>
          <p>Use o código abaixo para confirmar seu e-mail:</p>
          <h1 style="letter-spacing: 4px;">${code}</h1>
          <p>Este código expira em alguns minutos.</p>
        </div>
      `,
    });
  }

  /**
   * Valida o código enviado por e-mail
   */
  static async verifyCode(userId: string, code: string): Promise<boolean> {
    const user = await User.findById(userId);

    if (!user || !user.emailValidation || user.emailValidation.code !== code) {
      return false;
    }

    user.emailValidation.status = "verified";
    await user.save();

    return true;
  }

  /**
   * Envia código/token para reset de senha
   */
  static async sendPasswordReset(email: string, code: string): Promise<void> {
    await mailTransporter.sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject: "Redefinição de senha - TMJ",
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2>Redefinição de Senha</h2>
          <p>Use o código abaixo para redefinir sua senha:</p>
          <h1 style="letter-spacing: 4px;">${code}</h1>
          <p>Este código expira em alguns minutos.</p>
        </div>
      `,
    });
  }
}
