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
  static async sendPasswordReset(email: string, code: string): Promise<{ messageId?: string }> {
    if (!process.env.MAIL_HOST || !process.env.MAIL_PORT || !process.env.MAIL_USER || !process.env.MAIL_PASS || !process.env.MAIL_FROM) {
      throw new Error("Serviço de e-mail não configurado.");
    }

    try {
      const info = await mailTransporter.sendMail({
        from: process.env.MAIL_FROM,
        to: email,
        subject: "Redefinição de senha - TMJ",
        html: `
          <div style="font-family: Arial, sans-serif;">
            <h2>Redefinição de Senha</h2>
            <p>Use o código abaixo para redefinir sua senha:</p>
            <h1 style="letter-spacing: 4px;">${code}</h1>
            <p>Este código expira em 15 minutos.</p>
          </div>
        `,
      });
      return { messageId: info.messageId };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha SMTP desconhecida";
      console.error(`[EmailService] Falha ao enviar reset para ${email}: ${message}`);
      throw new Error("Não foi possível enviar o código de recuperação. Tente novamente.");
    }
  }
}
