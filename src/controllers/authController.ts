import { Request, Response } from "express";
import AuthService from "../services/authService";

class AuthController {
  // 🧾 REGISTER
  async register(req: Request, res: Response) {
    try {
      const { name, email, phone, password, role } = req.body;

      const result = await AuthService.register({
        name,
        email,
        phone,
        password,
        role,
      });

      return res.status(201).json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      const message = error.message || "Erro ao cadastrar usuário";
      const statusCode = message.includes("cadastrado") ? 409 : 400;

      return res.status(statusCode).json({
        success: false,
        message,
      });
    }
  }

  /**
   * @openapi
   * /auth/login:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Login do usuário (e-mail/telefone/identificador)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
 *             properties:
 *               identifier:
 *                 type: string
 *                 description: Campo legado. E-mail ou telefone
 *               email:
 *                 type: string
 *                 description: E-mail do usuário
 *               phone:
 *                 type: string
 *                 description: Telefone do usuário
 *               password:
 *                 type: string
   *     responses:
   *       '200':
   *         description: Autenticado com token
   *       '401':
   *         description: Credenciais inválidas
   */
  // 🔐 LOGIN
  async login(req: Request, res: Response) {
    try {
      const { identifier, email, phone, password } = req.body;

      if (!password || (!identifier && !email && !phone)) {
        return res.status(400).json({
          success: false,
          message: "Informe email ou phone e password",
        });
      }

      const result = await AuthService.login({
        identifier,
        email,
        phone,
        password,
      });

      return res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      return res.status(401).json({
        success: false,
        message: error.message || "Credenciais inválidas",
      });
    }
  }

  async logout(req: Request, res: Response) {
    try {
      const result = await AuthService.logout(req.user?.id);
      return res.status(200).json(result);
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message || "Erro ao realizar logout",
      });
    }
  }

  /**
   * @openapi
   * /auth/onboarding-status/{id}:
   *   get:
   *     tags:
   *       - Auth
   *     summary: Obtém o status de onboarding do usuário autenticado
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       '200':
   *         description: Usuário encontrado
   *       '404':
   *         description: Usuário não encontrado
   *       '500':
   *         description: Erro do servidor
   */
  // 📋 ONBOARDING STATUS

  async onboardingStatus(req: Request, res: Response) {
    try {
      const requestedId = req.params.id;
      const authenticatedUserId = req.user?.id;

      if (
        requestedId &&
        authenticatedUserId &&
        req.user?.role !== "admin" &&
        requestedId !== authenticatedUserId
      ) {
        return res.status(403).json({
          success: false,
          message: "Acesso não autorizado",
        });
      }

      const targetUserId = (requestedId || authenticatedUserId) as string;
      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          message: "ID do usuário não informado",
        });
      }

      const onboardingStatus = await AuthService.onboardingStatus(targetUserId);

      return res.status(200).json({
        onboardingStatus,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * @openapi
   * /auth/forgot-password:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Solicita código para redefinição de senha
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *     responses:
   *       '200':
   *         description: Código enviado se o e-mail existir
   */
  // 🔁 FORGOT PASSWORD
  async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;

      await AuthService.forgotPassword(email);

      return res.status(200).json({
        success: true,
        message: "Se o e-mail existir, um código foi enviado.",
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * @openapi
   * /auth/forgot-password/verify:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Verifica o código de reset enviado por e-mail
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *               code:
   *                 type: string
   *     responses:
   *       '200':
   *         description: Código válido
   *       '400':
   *         description: Código inválido
   */
  // 🔐 VALIDAR CÓDIGO RESET
  async verifyResetCode(req: Request, res: Response) {
    try {
      const { email, code } = req.body;

      await AuthService.verifyResetCode(email, code);

      return res.status(200).json({
        success: true,
        message: "Código válido",
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * @openapi
   * /auth/reset-password:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Redefine a senha usando código de reset
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *               code:
   *                 type: string
   *               newPassword:
   *                 type: string
   *     responses:
   *       '200':
   *         description: Senha alterada com sucesso
   *       '400':
   *         description: Erro ao redefinir senha
   */
  // 🔑 RESET PASSWORD
  async resetPassword(req: Request, res: Response) {
    try {
      const { email, code, newPassword } = req.body;

      await AuthService.resetPassword(email, code, newPassword);

      return res.status(200).json({
        success: true,
        message: "Senha alterada com sucesso",
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * @openapi
   * /auth/email/send-code:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Envia código de verificação para o e-mail do usuário autenticado
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Código enviado
   *       '401':
   *         description: Não autorizado
   */
  // 📧 ENVIAR CÓDIGO EMAIL
  async sendEmailCode(req: Request, res: Response) {
    try {
      const userId = req.user!.id;

      const result = await AuthService.sendEmailVerificationCode(userId);

      return res.status(200).json({
        success: true,
        message: "Código enviado para o e-mail",
        ...result,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * @openapi
   * /auth/email/verify:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Verifica código de e-mail do usuário autenticado
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               code:
   *                 type: string
   *     responses:
   *       '200':
   *         description: E-mail validado
   *       '400':
   *         description: Código inválido
   */
  // 📧 VALIDAR EMAIL
  async verifyEmail(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { code } = req.body;

      const result = await AuthService.verifyEmail(userId, code);

      return res.status(200).json({
        success: true,
        message: "E-mail validado com sucesso",
        ...result,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * @openapi
   * /auth/phone/send-code:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Envia código por SMS para o telefone do usuário autenticado
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       '200':
   *         description: Código enviado por SMS
   */
  // 📱 ENVIAR CÓDIGO TELEFONE
  async sendPhoneCode(req: Request, res: Response) {
    try {
      const userId = req.user!.id;

      const result = await AuthService.sendPhoneVerificationCode(userId);

      return res.status(200).json({
        success: true,
        message: "Código enviado por SMS",
        ...result,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * @openapi
   * /auth/phone/verify:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Verifica código SMS do usuário autenticado
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               code:
   *                 type: string
   *     responses:
   *       '200':
   *         description: Telefone validado
   *       '400':
   *         description: Código inválido
   */
  // 📱 VALIDAR TELEFONE
  async verifyPhone(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { code } = req.body;

      const result = await AuthService.verifyPhone(userId, code);

      return res.status(200).json({
        success: true,
        message: "Telefone validado com sucesso",
        ...result,
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * @openapi
   * /auth/resend-code:
   *   post:
   *     tags:
   *       - Auth
   *     summary: Reenvia código (EMAIL | PHONE | RESET_PASSWORD) para o usuário autenticado
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               type:
   *                 type: string
   *                 enum: [EMAIL, PHONE, RESET_PASSWORD]
   *     responses:
   *       '200':
   *         description: Código reenviado com sucesso
   *       '400':
   *         description: Tipo inválido
   */
  // 🔄 REENVIO GENÉRICO
  async resendCode(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { type } = req.body; // EMAIL | PHONE | RESET_PASSWORD

      await AuthService.resendCode(userId, type);

      return res.status(200).json({
        success: true,
        message: "Código reenviado com sucesso",
      });
    } catch (error: any) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export default new AuthController();
