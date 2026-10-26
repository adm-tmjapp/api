import User, { IUser } from "../models/User";
import { generateVerificationCode } from "../utils/generateCode";
import { mailTransporter, tmjMailIdentity, tmjMailSubjects } from "../config/mail";

function emailLayout(content: string) {
  return `
    <div style="margin:0;background:#f7f7f9;padding:32px 16px;font-family:Arial,sans-serif;color:#162033;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #ececf1;border-radius:16px;overflow:hidden;">
        <div style="background:#cf2f7d;padding:24px 28px;color:#ffffff;font-size:24px;font-weight:700;">TMJApp</div>
        <div style="padding:28px;line-height:1.6;">${content}</div>
        <div style="border-top:1px solid #ececf1;padding:18px 28px;color:#68738a;font-size:12px;">
          Este é um e-mail automático do TMJApp. Se você não solicitou esta ação, ignore esta mensagem.
        </div>
      </div>
    </div>
  `;
}

function mailOptions(to: string, subject: string, content: string, text: string) {
  return {
    from: tmjMailIdentity,
    replyTo: tmjMailIdentity.replyTo,
    to,
    subject,
    text,
    html: emailLayout(content),
  };
}

export class EmailService {
  private static readonly verificationCodeTtlMs = 15 * 60 * 1000;
  private static readonly verificationResendCooldownMs = 60 * 1000;

  /**
   * Envia código de verificação por e-mail
   */
  static async sendVerificationCode(userId: string): Promise<void> {
    const user = await User.findById(userId);

    if (!user) {
      throw new Error("Usuário não encontrado");
    }

    const lastSentAt = user.emailValidation?.sentAt?.getTime();
    if (
      user.emailValidation?.status === "pending" &&
      lastSentAt &&
      Date.now() - lastSentAt < this.verificationResendCooldownMs
    ) {
      throw new Error("Aguarde um minuto antes de solicitar outro código.");
    }

    const code = generateVerificationCode(6);

    user.emailValidation = {
      email: user.email,
      code,
      status: "pending",
      sentAt: new Date(),
    };

    await user.save();

    await mailTransporter.sendMail(mailOptions(
      user.email,
      tmjMailSubjects.emailVerification,
      `<h2>Confirme seu e-mail</h2><p>Use o código abaixo para confirmar seu endereço de e-mail:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;">${code}</p><p>Se você não solicitou este cadastro, ignore esta mensagem.</p>`,
      `Seu código de confirmação do TMJApp é ${code}. Se você não solicitou este cadastro, ignore esta mensagem.`
    ));
  }

  /**
   * Valida o código enviado por e-mail
   */
  static async verifyCode(userId: string, code: string): Promise<boolean> {
    const user = await User.findById(userId);

    if (!user || !user.emailValidation || user.emailValidation.code !== code) {
      return false;
    }

    if (
      !user.emailValidation.sentAt ||
      Date.now() - user.emailValidation.sentAt.getTime() > this.verificationCodeTtlMs
    ) {
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
    if (!process.env.MAIL_HOST || !process.env.MAIL_PORT || !process.env.MAIL_USER || !process.env.MAIL_PASS) {
      throw new Error("Serviço de e-mail não configurado.");
    }

    try {
      const info = await mailTransporter.sendMail(mailOptions(
        email,
        tmjMailSubjects.passwordReset,
        `<h2>Recupere sua senha</h2><p>Recebemos uma solicitação para redefinir sua senha no TMJApp.</p><p>Seu código de confirmação é:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;">${code}</p><p>Este código expira em 15 minutos.</p>`,
        `Seu código para recuperar a senha do TMJApp é ${code}. Ele expira em 15 minutos.`
      ));
      return { messageId: info.messageId };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha SMTP desconhecida";
      console.error(`[EmailService] Falha ao enviar reset para ${email}: ${message}`);
      throw new Error("Não foi possível enviar o código de recuperação. Tente novamente.");
    }
  }

  static async sendPasswordChanged(email: string): Promise<{ messageId?: string }> {
    if (!process.env.MAIL_HOST || !process.env.MAIL_PORT || !process.env.MAIL_USER || !process.env.MAIL_PASS) {
      throw new Error("Serviço de e-mail não configurado.");
    }

    const info = await mailTransporter.sendMail(mailOptions(
      email,
      tmjMailSubjects.passwordChanged,
      "<h2>Senha alterada com sucesso</h2><p>Sua senha do TMJApp foi alterada.</p><p>Se você não realizou esta alteração, entre em contato com o suporte imediatamente.</p>",
      "Sua senha do TMJApp foi alterada. Se você não realizou esta alteração, entre em contato com o suporte imediatamente."
    ));

    return { messageId: info.messageId };
  }

  static async sendWelcomeEmail(user: Pick<IUser, "name" | "email" | "role">): Promise<{ messageId?: string }> {
    if (!process.env.MAIL_HOST || !process.env.MAIL_PORT || !process.env.MAIL_USER || !process.env.MAIL_PASS) {
      throw new Error("Serviço de e-mail não configurado.");
    }

    const isDriver = user.role === "driver";
    const nextStep = isDriver
      ? "Acesse o aplicativo para acompanhar a análise do seu cadastro e concluir os próximos passos."
      : "Acesse o aplicativo e comece a usar os recursos disponíveis para você.";

    const info = await mailTransporter.sendMail(mailOptions(
      user.email,
      tmjMailSubjects.welcome,
      `<h2>Olá, ${user.name}!</h2><p>Sua conta TMJApp foi confirmada com sucesso.</p><p>${nextStep}</p><p style="margin-top:24px;font-weight:700;">Estamos felizes em ter você com a gente.</p>`,
      `Olá, ${user.name}! Sua conta TMJApp foi confirmada com sucesso. ${nextStep} Estamos felizes em ter você com a gente.`
    ));

    return { messageId: info.messageId };
  }
}
