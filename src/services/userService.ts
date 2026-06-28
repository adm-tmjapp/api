import User, { IUser } from "../models/User";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import DriverDocumentService from "./driverDocumentService";

export class UserService {
  // Criar novo usuário com senha criptografada
  static async createUser(data: {
    name: string;
    email: string;
    password: string;
    phone: string;
    role: "passenger" | "driver" | "admin";
  }): Promise<IUser> {
    // Criptografar a senha antes de salvar
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(data.password, saltRounds);

    const user = new User({
      ...data,
      password: hashedPassword,
      phoneVerified: true,
      authStatus: data.role === "driver" ? "PENDING_EMAIL" : "ACTIVE",
    });

    return user.save();
  }

  // Buscar usuário por ID
  static async getUserById(
    userId: string | mongoose.Types.ObjectId
  ): Promise<IUser | null> {
    return User.findById(userId).exec();
  }

  // Buscar usuário por email
  static async getUserByEmail(email: string): Promise<IUser | null> {
    return User.findOne({ email: email.toLowerCase() }).exec();
  }

  // Atualizar dados do usuário (nome, telefone etc.)
  static async updateUser(
    userId: string | mongoose.Types.ObjectId,
    update: Partial<Pick<IUser, "name" | "phone">>
  ): Promise<IUser | null> {
    return User.findByIdAndUpdate(userId, update, { new: true }).exec();
  }

  // Atualizar foto de perfil
  static async updateProfilePhoto(
    userId: string | mongoose.Types.ObjectId,
    fileUrl: string
  ): Promise<IUser | null> {
    return User.findByIdAndUpdate(
      userId,
      { profilePhoto: fileUrl },
      { new: true }
    ).exec();
  }

  static async uploadProfilePhoto(
    userId: string | mongoose.Types.ObjectId,
    file: any
  ): Promise<IUser | null> {
    const normalizedUserId = userId.toString();
    const fileUrl = await DriverDocumentService.uploadFile(file, normalizedUserId);

    return User.findByIdAndUpdate(
      normalizedUserId,
      {
        profilePhoto: fileUrl,
      },
      { new: true }
    ).exec();
  }

  // Bloquear usuário
  static async blockUser(
    userId: string | mongoose.Types.ObjectId
  ): Promise<IUser | null> {
    return User.findByIdAndUpdate(
      userId,
      { authStatus: "BLOCKED" },
      { new: true }
    ).exec();
  }

  // Comparar senha (útil para login)
  static async comparePassword(
    user: IUser,
    password: string
  ): Promise<boolean> {
    return bcrypt.compare(password, user.password);
  }
}
