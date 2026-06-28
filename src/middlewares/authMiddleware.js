"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const authMiddleware = (role) => {
    return (req, res, next) => {
        const authHeader = req.header("Authorization");
        console.log(authHeader);
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Acesso não autorizado" });
        }
        const token = authHeader.split(" ")[1];
        try {
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            // Verificar se o usuário tem o papel correto
            if (req.user.role !== role) {
                return res.status(403).json({ message: "Acesso negado. Você não tem permissão para acessar essa rota." });
            }
            next();
        }
        catch (error) {
            res.status(401).json({ message: "Token inválido" });
        }
    };
};
exports.default = authMiddleware;
