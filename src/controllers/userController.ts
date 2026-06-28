import { Request, Response } from "express";
import { UserService } from "../services/userService";

export class UserController {
  private static serializeUser(user: any) {
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      authStatus: user.authStatus,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      profilePhoto: user.profilePhoto,
      profilePhotoDocument: user.profilePhotoDocument,
    };
  }
  /**
   * @openapi
   * /users:
   *   post:
   *     tags:
   *       - Users
   *     summary: Criar um novo usuário
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               email:
   *                 type: string
   *               password:
   *                 type: string
   *               phone:
   *                 type: string
   *               role:
   *                 type: string
   *             required: [name, email, password, phone, role]
   *     responses:
   *       '201':
   *         description: Usuário criado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 user:
   *                   type: object
   *       '400':
   *         description: Campos obrigatórios ausentes
   *       '409':
   *         description: Usuário já existe
   *       '500':
   *         description: Erro do servidor
   */
  // Criar um novo usuário
  static async createUser(req: Request, res: Response) {
    try {
      const { name, email, password, phone, role } = req.body;

      // Validar campos obrigatórios
      if (!name || !email || !password || !phone || !role) {
        return res.status(400).json({
          success: false,
          message: "Todos os campos são obrigatórios",
        });
      }

      // Checar se usuário já existe
      const existingUser = await UserService.getUserByEmail(email);
      if (existingUser) {
        return res
          .status(409)
          .json({ success: false, message: "Usuário já existe" });
      }

      const user = await UserService.createUser({
        name,
        email,
        password,
        phone,
        role,
      });
      return res.status(201).json({ success: true, user });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Erro ao criar usuário",
        error: error.message,
      });
    }
  }

  /**
   * @openapi
   * /users/{id}:
   *   get:
   *     tags:
   *       - Users
   *     summary: Buscar usuário por ID
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       '200':
   *         description: Usuário encontrado
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 user:
   *                   type: object
   *       '404':
   *         description: Usuário não encontrado
   *       '500':
   *         description: Erro do servidor
   */
  // Buscar usuário por ID
  static async getUserById(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const user = await UserService.getUserById(id);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "Usuário não encontrado" });
      }
      return res.status(200).json({ success: true, user });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Erro ao buscar usuário",
        error: error.message,
      });
    }
  }

  /**
   * @openapi
   * /users/{id}:
   *   put:
   *     tags:
   *       - Users
   *     summary: Atualizar dados do usuário (nome e telefone)
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               name:
   *                 type: string
   *               phone:
   *                 type: string
   *     responses:
   *       '200':
   *         description: Usuário atualizado
   *       '404':
   *         description: Usuário não encontrado
   *       '500':
   *         description: Erro do servidor
   */
  // Atualizar dados do usuário (nome e telefone)
  static async updateUser(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { name, phone } = req.body;

      const updatedUser = await UserService.updateUser(id, { name, phone });
      if (!updatedUser) {
        return res
          .status(404)
          .json({ success: false, message: "Usuário não encontrado" });
      }

      return res.status(200).json({ success: true, user: updatedUser });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Erro ao atualizar usuário",
        error: error.message,
      });
    }
  }

  /**
   * @openapi
   * /users/{id}/photo:
   *   put:
   *     tags:
   *       - Users
   *     summary: Atualizar foto de perfil
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               fileUrl:
   *                 type: string
   *             required: [fileUrl]
   *     responses:
   *       '200':
   *         description: Foto atualizada
   *       '400':
   *         description: URL da foto é obrigatória
   *       '404':
   *         description: Usuário não encontrado
   *       '500':
   *         description: Erro do servidor
   */
  // Atualizar foto de perfil
  static async updateProfilePhoto(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const { fileUrl } = req.body;

      if (!fileUrl) {
        return res
          .status(400)
          .json({ success: false, message: "URL da foto é obrigatória" });
      }

      const updatedUser = await UserService.updateProfilePhoto(id, fileUrl);
      if (!updatedUser) {
        return res
          .status(404)
          .json({ success: false, message: "Usuário não encontrado" });
      }

      return res.status(200).json({ success: true, user: updatedUser });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Erro ao atualizar foto de perfil",
        error: error.message,
      });
    }
  }

  static async uploadOwnProfilePhoto(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      const file = (req as any).file;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuário não autenticado",
        });
      }

      if (!file) {
        return res.status(400).json({
          success: false,
          message: "Arquivo não enviado",
        });
      }

      const updatedUser = await UserService.uploadProfilePhoto(userId, file);

      if (!updatedUser) {
        return res.status(404).json({
          success: false,
          message: "Usuário não encontrado",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Foto de perfil salva com sucesso",
        user: UserController.serializeUser(updatedUser),
      });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Erro ao salvar foto de perfil",
        error: error.message,
      });
    }
  }

  /**
   * @openapi
   * /users/{id}/block:
   *   put:
   *     tags:
   *       - Users
   *     summary: Bloquear usuário
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       '200':
   *         description: Usuário bloqueado
   *       '404':
   *         description: Usuário não encontrado
   *       '500':
   *         description: Erro do servidor
   */
  // Bloquear usuário
  static async blockUser(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      const blockedUser = await UserService.blockUser(id);

      if (!blockedUser) {
        return res
          .status(404)
          .json({ success: false, message: "Usuário não encontrado" });
      }

      return res.status(200).json({ success: true, user: blockedUser });
    } catch (error: any) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Erro ao bloquear usuário",
        error: error.message,
      });
    }
  }
}
