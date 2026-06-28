import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User, { IUser } from "../models/User";
import { EmailService } from "./emailService";
import { SmsService } from "./smsService";
import { generateVerificationCode } from "../utils/generateCode";
import { OnboardingService } from "./onboardingService";
import { passengerAppService } from "../v2/services/passengerAppService";

export class AuthService {
  /* =====================================================
   * Helpers internos
   ===================================================== */

  private static maskCpf(cpf?: string | null) {
    if (!cpf) return null;
    const cleaned = cpf.replace(/\D/g, "");
    if (cleaned.length !== 11) return null;
    return `${cleaned.slice(0, 3)}.***.***-${cleaned.slice(-2)}`;
  }

  private static updateAuthStatus(user: IUser) {
    if (user.emailVerified) {
      user.authStatus = "ACTIVE";
      return;
    }

    user.authStatus = "PENDING_EMAIL";
  }

  private static generateToken(user: IUser) {
    return jwt.sign(
      {
        id: user._id,
        role: user.role,
        authStatus: user.authStatus,
      },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );
  }

  private static async buildAuthResponse(user: IUser) {
    let onboardingStatus = null;

    if (user.role === "driver" || user.role === "admin") {
      onboardingStatus = await OnboardingService.buildDriverOnboarding(user);
    } else if (user.role === "passenger") {
      onboardingStatus = await passengerAppService.getOnboardingStatus(
        String(user._id),
      );
    }

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        authStatus: user.authStatus,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        cpfMasked: this.maskCpf(user.cpf),
      },
      onboardingStatus,
    };
  }

  /* =====================================================
   * Auth
   ===================================================== */

  static async register(input: {
    name: string;
    email: string;
    phone: string;
    password: string;
    role: "passenger" | "driver" | "admin";
  }) {
    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase();
    const phone = input.phone?.trim();
    const password = input.password;
    const role = input.role;

    if (!name || !email || !phone || !password || !role) {
      throw new Error("Todos os campos são obrigatórios");
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      throw new Error("E-mail já cadastrado");
    }

    const existingPhone = await User.findOne({ phone });
    if (existingPhone) {
      throw new Error("Telefone já cadastrado");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role,
      phoneVerified: true,
      authStatus: role === "driver" ? "PENDING_EMAIL" : "ACTIVE",
    });

    const token = this.generateToken(user);
    const authPayload = await this.buildAuthResponse(user);

    return {
      token,
      ...authPayload,
    };
  }

  static async login(input: {
    identifier?: string;
    email?: string;
    phone?: string;
    password: string;
  }) {
    const rawIdentifier = input.identifier || input.email || input.phone;
    const identifier = rawIdentifier?.toString().trim();

    if (!identifier || !input.password) {
      throw new Error("Credenciais inválidas");
    }

    const normalizedIdentifier = identifier.includes("@")
      ? identifier.toLowerCase()
      : identifier;

    const user = await User.findOne({
      $or: [{ email: normalizedIdentifier }, { phone: normalizedIdentifier }],
    });

    if (!user) {
      throw new Error("Credenciais inválidas");
    }

    if (user.authStatus === "BLOCKED") {
      throw new Error("Usuário bloqueado");
    }

    const passwordMatch = await bcrypt.compare(input.password, user.password);
    if (!passwordMatch) {
      throw new Error("Credenciais inválidas");
    }

    const token = this.generateToken(user);
    const authPayload = await this.buildAuthResponse(user);

    return {
      token,
      ...authPayload,
    };
  }

  static async logout(_userId?: string) {
    return {
      success: true,
      message: "Logout realizado com sucesso.",
    };
  }

  static async onboardingStatus(userId: string) {
    const user = await User.findById(userId);
    if (!user) throw new Error("Usuário não encontrado");
    if (user.role === "driver" || user.role === "admin") {
      return OnboardingService.buildDriverOnboarding(user);
    }

    if (user.role === "passenger") {
      return passengerAppService.getOnboardingStatus(String(user._id));
    }

    return null;
  }

  /* =====================================================
   * Forgot Password
   ===================================================== */

  static async forgotPassword(email: string) {
    const user = await User.findOne({ email });
    if (!user) return;

    const code = generateVerificationCode(6);

    user.resetValidation = {
      email: user.email,
      code,
      status: "pending",
      sentAt: new Date(),
    } as any;

    await user.save();

    await EmailService.sendPasswordReset(user.email, code);
  }

  static async verifyResetCode(email: string, code: string) {
    const user = await User.findOne({ email });

    if (!user || !user.resetValidation || user.resetValidation.code !== code) {
      throw new Error("Código inválido");
    }

    user.resetValidation.status = "verified";
    await user.save();
  }

  static async resetPassword(email: string, code: string, newPassword: string) {
    const user = await User.findOne({ email });

    if (!user || !user.resetValidation || user.resetValidation.code !== code) {
      throw new Error("Código inválido");
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetValidation = undefined as any;
    await user.save();
  }

  /* =====================================================
   * Email Verification
   ===================================================== */

  static async sendEmailVerification(userId: string) {
    await EmailService.sendVerificationCode(userId);
  }

  // Wrappers with controller-expected names
  static async sendEmailVerificationCode(userId: string) {
    await this.sendEmailVerification(userId);

    const user = await User.findById(userId);
    if (!user) throw new Error("Usuário não encontrado");

    return {
      channel: "EMAIL",
      sentTo: user.email,
      sentAt: user.emailValidation?.sentAt || null,
    };
  }

  static async verifyEmailCode(userId: string, code: string) {
    const user = await User.findById(userId);

    if (!user || !user.emailValidation || user.emailValidation.code !== code) {
      throw new Error("Código inválido");
    }

    user.emailValidation.status = "verified";
    user.emailVerified = true;
    user.phoneVerified = true;
    user.phoneValidation = undefined;

    this.updateAuthStatus(user);
    await user.save();
  }

  static async verifyEmail(userId: string, code: string) {
    await this.verifyEmailCode(userId, code);

    const user = await User.findById(userId);
    if (!user) throw new Error("Usuário não encontrado");

    const token = this.generateToken(user);
    const authPayload = await this.buildAuthResponse(user);

    return {
      token,
      ...authPayload,
    };
  }

  /* =====================================================
   * Phone (SMS) Verification
   ===================================================== */

  static async sendPhoneVerification(userId: string) {
    const user = await User.findById(userId);
    if (!user) throw new Error("Usuário não encontrado");

    const code = generateVerificationCode(6);

    user.phoneValidation = {
      phone: user.phone,
      code,
      status: "pending",
      sentAt: new Date(),
    };

    await user.save();

    await SmsService.sendCode(user.phone, code, userId);
  }

  static async sendPhoneVerificationCode(userId: string) {
    await this.sendPhoneVerification(userId);

    const user = await User.findById(userId);
    if (!user) throw new Error("Usuário não encontrado");

    return {
      channel: "PHONE",
      sentTo: user.phone,
      sentAt: user.phoneValidation?.sentAt || null,
    };
  }

  static async verifyPhoneCode(userId: string, code: string) {
    const user = await User.findById(userId);

    if (!user || !user.phoneValidation || user.phoneValidation.code !== code) {
      throw new Error("Código inválido");
    }

    user.phoneValidation.status = "verified";
    user.phoneVerified = true;

    this.updateAuthStatus(user);
    await user.save();
  }

  static async verifyPhone(userId: string, code: string) {
    await this.verifyPhoneCode(userId, code);

    const user = await User.findById(userId);
    if (!user) throw new Error("Usuário não encontrado");

    const token = this.generateToken(user);
    const authPayload = await this.buildAuthResponse(user);

    return {
      token,
      ...authPayload,
    };
  }

  static async resendCode(userId: string, type: string) {
    const user = await User.findById(userId);
    if (!user) throw new Error("Usuário não encontrado");

    if (type === "EMAIL") {
      return this.sendEmailVerificationCode(userId);
    }

    if (type === "PHONE") {
      return this.sendPhoneVerificationCode(userId);
    }

    if (type === "RESET_PASSWORD") {
      const code = generateVerificationCode(6);
      user.resetValidation = {
        email: user.email,
        code,
        status: "pending",
        sentAt: new Date(),
      } as any;
      await user.save();
      return EmailService.sendPasswordReset(user.email, code);
    }

    throw new Error("Tipo inválido");
  }
}

export default AuthService;
