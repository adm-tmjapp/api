import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "node:path";
import http from "node:http";

import userRoutes from "./routes/userRoutes";
import rideRoutes from "./routes/rideRoutes";
import driverRoutes from "./routes/driverRoutes";
import authRoutes from "./routes/authRoutes";
import tarifaRoutes from "./routes/tarifaRoutes";
import vehicleRoutes from "./routes/vehicleRoutes";
import productRoutes from "./routes/productRoutes";
import apiV2Routes from "./v2";

import { swaggerUi, swaggerSpec } from "./config/swagger";
import { ensureVehicleIndexes } from "./config/ensureVehicleIndexes";
import swaggerAccessMiddleware from "./middlewares/swaggerAccessMiddleware";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 8080;

// Middlewares
app.use(cors());
app.use(express.json());

// Swagger docs
app.use(
  "/api-docs",
  swaggerAccessMiddleware,
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec),
);

// Arquivos locais de upload para ambientes sem S3 configurado
app.use("/uploads/files", express.static(path.join(process.cwd(), "uploads")));

// Servir o frontend do painel administrativo pela rota /admin
app.use("/admin", express.static(path.join(__dirname, "../frontend/build")));

// Redireciona para index.html apenas se não for arquivo estático
app.get("/admin/*", (req, res, next) => {
  if (req.path.startsWith("/admin/static/")) {
    res.status(404).end();
  } else {
    res.sendFile(path.join(__dirname, "../frontend/build", "index.html"));
  }
});

// Rota para renderizar a tela DownloadPage
app.get("/download", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/build/index.html"));
});

// // // Middleware para servir arquivos estáticos do React
app.use(express.static(path.join(__dirname, "../frontend/build")));

// Endpoint público (Elastic Beanstalk usa como health check básico)
app.get("/", (req, res) => {
  res.status(200).send("✅ TMJ API está online!");
});

// Endpoint avançado de health check (com verificação do MongoDB)
app.get("/health", async (req, res) => {
  const mongoStatus = mongoose.connection.readyState;

  const health = {
    status: mongoStatus === 1 ? "ok" : "fail",
    uptime: process.uptime(),
    timestamp: Date.now(),
    mongo: {
      status: mongoStatus === 1 ? "connected" : "disconnected",
      code: mongoStatus,
    },
  };

  const statusCode = mongoStatus === 1 ? 200 : 500;
  res.status(statusCode).json(health);
});

// Rotas principais
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/tarifas", tarifaRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/produtos", productRoutes);
app.use("/api/drivers", driverRoutes);

// API V2 - organização por visão (admin/passenger/driver)
app.use("/api/v2", apiV2Routes);

// Inicia a aplicação de forma resiliente com tratamento de erros e shutdown gracioso
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    await ensureVehicleIndexes();
    console.log("🔥 MongoDB conectado!");

    const server = http.createServer(app);

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        console.error(`❌ Porta ${PORT} já está em uso.`);
        process.exit(1);
      }
      console.error("❌ Erro no servidor:", err);
      process.exit(1);
    });

    server.listen(PORT, () => {
      console.log(`⚡ Servidor rodando na porta ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Erro ao conectar ao MongoDB:", err);
    process.exit(1); // Encerra o processo se falhar
  }
}

startServer();
