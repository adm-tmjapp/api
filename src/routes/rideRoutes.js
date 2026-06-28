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
const authMiddleware_1 = __importDefault(require("../middlewares/authMiddleware"));
const Ride_1 = __importDefault(require("../models/Ride"));
const router = express_1.default.Router();
// Rota protegida para qualquer usuário autenticado
router.get("/protected", (0, authMiddleware_1.default)("passenger"), (req, res) => {
    res.json({ message: "Você acessou uma rota protegida!", user: req.user });
});
// Criar uma nova corrida (somente passageiro pode criar uma corrida)
router.post("/request", (0, authMiddleware_1.default)("passenger"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { passengerId, origin, destination, fare } = req.body;
        const newRide = new Ride_1.default({
            passengerId,
            driverId: null,
            origin,
            destination,
            fare,
            status: "pending",
        });
        yield newRide.save();
        res.status(201).json(newRide);
    }
    catch (error) {
        res.status(500).json({ message: "Erro ao solicitar corrida" });
    }
}));
// Listar corridas pendentes (somente motorista pode acessar)
router.get("/pending", (0, authMiddleware_1.default)("driver"), (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const rides = yield Ride_1.default.find({ status: "pending" }).populate("passengerId", "name");
        res.json(rides);
    }
    catch (error) {
        res.status(500).json({ message: "Erro ao buscar corridas" });
    }
}));
router.get("/teste", (0, authMiddleware_1.default)("passenger"), (req, res) => {
    res.json({ message: "Você acessou uma rota protegida!", user: req.user });
});
exports.default = router;
