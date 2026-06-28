"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const authMiddleware_1 = __importDefault(require("../middlewares/authMiddleware"));
const router = express_1.default.Router();
// Rota de cadastro
router.post("/register", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, email, password, phone, role } = req.body;
        const userExists = yield User_1.default.findOne({ email });
        if (userExists)
            return res.status(400).json({ message: "Usuário já existe" });
        const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
        const newUser = new User_1.default({ name, email, password: hashedPassword, phone, role });
        yield newUser.save();
        res.status(201).json({ message: "Usuário cadastrado com sucesso!" });
    }
    catch (error) {
        res.status(500).json({ message: "Erro no servidor" });
    }
}));
// Rota de login
router.post("/login", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, password } = req.body;
        const user = yield User_1.default.findOne({ email });
        if (!user)
            return res.status(404).json({ message: "Usuário não encontrado" });
        const isValidPassword = yield bcryptjs_1.default.compare(password, user.password);
        if (!isValidPassword)
            return res.status(400).json({ message: "Senha incorreta" });
        const token = jsonwebtoken_1.default.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
        res.json({ token, user });
    }
    catch (error) {
        res.status(500).json({ message: "Erro no servidor" });
    }
}));
router.post("/auth-phone", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { phone } = req.body;
        const user = yield User_1.default.findOne({ phone });
        if (!user)
            return res.status(404).json({ message: "Usuário não encontrado" });
        const token = jsonwebtoken_1.default.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
        res.json({ token, user });
    }
    catch (error) {
        res.status(500).json({ message: "Erro no servidor" });
    }
}));
router.get("/profile", (0, authMiddleware_1.default)("passenger"), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const user = yield User_1.default.findById((_a = req.user) === null || _a === void 0 ? void 0 : _a.id);
        if (!user)
            return res.status(404).json({ message: "Usuário não encontrado" });
        res.json(user);
    }
    catch (error) {
        res.status(500).json({ message: "Erro ao buscar perfil do usuário", error });
    }
}));
exports.default = router;
