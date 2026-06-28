"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const mongoose_1 = __importDefault(require("mongoose"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const rideRoutes_1 = __importDefault(require("./routes/rideRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middlewares
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Conectar ao MongoDB
mongoose_1.default.connect(process.env.MONGO_URI)
    .then(() => console.log("🔥 MongoDB conectado!"))
    .catch(err => console.log("Erro ao conectar ao MongoDB:", err));
// Rotas
app.use("/api/users", userRoutes_1.default);
app.use("/api/rides", rideRoutes_1.default);
const tarifaRoutes = require('./routes/tarifaRoutes');
app.use('/api/tarifas', tarifaRoutes);
app.use("/api/rides", rideRoutes_1.default);
const vehicleRoutes = require('./routes/vehicleRoutes');
app.use('/api/vehicles', vehicleRoutes);
// Iniciar servidor
app.listen(PORT, () => console.log(`⚡ Servidor rodando na porta ${PORT}`));
