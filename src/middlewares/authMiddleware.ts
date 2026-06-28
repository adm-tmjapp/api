import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt from "jsonwebtoken";

interface JwtPayload {
  id: string;
  role: "passenger" | "driver" | "admin";
}

type Role = "admin" | "driver" | "passenger";

function verifyTokenAndAttachUser(
  req: Request,
  res: Response
): { ok: boolean } {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.status(401).json({
      success: false,
      message: "Token não informado",
    });
    return { ok: false };
  }

  const [, token] = authHeader.split(" ");

  if (!token) {
    res.status(401).json({
      success: false,
      message: "Token inválido",
    });
    return { ok: false };
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as JwtPayload;

    req.user = {
      id: decoded.id,
      role: decoded.role,
    };

    return { ok: true };
  } catch (error) {
    res.status(401).json({
      success: false,
      message: "Token expirado ou inválido",
    });
    return { ok: false };
  }
}

// Overloads: support zero-arg factory `authMiddleware()` returning a RequestHandler,
// role factory `authMiddleware('role')`, or direct middleware `authMiddleware(req,res,next)`.
function authMiddleware(): RequestHandler;
function authMiddleware(role: Role): RequestHandler;
function authMiddleware(req: Request, res: Response, next: NextFunction): void;
function authMiddleware(arg1?: any, arg2?: any, arg3?: any): any {
  // Called as factory with role: authMiddleware('driver')
  if (typeof arg1 === "string" || Array.isArray(arg1)) {
    const roles = Array.isArray(arg1) ? arg1 : [arg1];
    return (req: Request, res: Response, next: NextFunction) => {
      const ok = verifyTokenAndAttachUser(req, res);
      if (!ok.ok) return;

      if (!req.user || !roles.includes(req.user.role)) {
        res
          .status(403)
          .json({ success: false, message: "Acesso não autorizado" });
        return;
      }
      next();
    };
  }

  // Called as zero-arg factory: authMiddleware() -> return RequestHandler
  if (typeof arg1 === "undefined") {
    return (req: Request, res: Response, next: NextFunction) => {
      const ok = verifyTokenAndAttachUser(req, res);
      if (!ok.ok) return;
      next();
    };
  }

  // Called directly as middleware: authMiddleware(req,res,next)
  const req: Request = arg1;
  const res: Response = arg2;
  const next: NextFunction = arg3;

  const ok = verifyTokenAndAttachUser(req, res);
  if (!ok.ok) return;

  next();
}

export function roleMiddleware(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: "Acesso não autorizado",
      });
      return;
    }
    next();
  };
}

export default authMiddleware;
