import bcrypt from "bcryptjs";
import User from "../models/User";

const DEFAULT_ADMIN_EMAIL = "adm@tmjapp.com.br";
const DEFAULT_ADMIN_PASSWORD = "Tmj@2026";
const DEFAULT_ADMIN_NAME = "Administrador TMJ";
const DEFAULT_ADMIN_PHONE = "+5500000000000";

export async function ensureDefaultAdminUser() {
  const email = (
    process.env.DEFAULT_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL
  ).trim().toLowerCase();
  const password = process.env.DEFAULT_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  const name = process.env.DEFAULT_ADMIN_NAME || DEFAULT_ADMIN_NAME;
  const phone = process.env.DEFAULT_ADMIN_PHONE || DEFAULT_ADMIN_PHONE;

  const existingAdmin = await User.findOne({ email });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role: "admin",
      emailVerified: true,
      phoneVerified: true,
      authStatus: "ACTIVE",
    });

    console.log(`✅ Usuário administrador padrão criado: ${email}`);
    return;
  }

  let changed = false;

  if (existingAdmin.role !== "admin") {
    existingAdmin.role = "admin";
    changed = true;
  }

  if (existingAdmin.authStatus !== "ACTIVE") {
    existingAdmin.authStatus = "ACTIVE";
    changed = true;
  }

  if (!existingAdmin.emailVerified) {
    existingAdmin.emailVerified = true;
    changed = true;
  }

  if (!existingAdmin.phoneVerified) {
    existingAdmin.phoneVerified = true;
    changed = true;
  }

  if (changed) {
    await existingAdmin.save();
    console.log(`✅ Usuário administrador padrão atualizado: ${email}`);
    return;
  }

  console.log(`ℹ️ Usuário administrador padrão já existe: ${email}`);
}
