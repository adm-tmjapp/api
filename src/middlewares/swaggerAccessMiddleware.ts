import { Request, Response, NextFunction } from "express";

function parseBasicAuth(authHeader?: string): { password?: string } {
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return {};
  }

  const encoded = authHeader.replace("Basic ", "");
  const decoded = Buffer.from(encoded, "base64").toString("utf-8");
  const [, password] = decoded.split(":");

  return { password };
}

export default function swaggerAccessMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const expectedCode = process.env.SWAGGER_ACCESS_CODE;

  if (!expectedCode) {
    res.status(500).json({
      success: false,
      message: "SWAGGER_ACCESS_CODE não configurado no ambiente.",
    });
    return;
  }

  const headerCode = req.header("x-swagger-code");
  const queryCode = typeof req.query.code === "string" ? req.query.code : undefined;
  const basicPassword = parseBasicAuth(req.header("authorization")).password;

  const providedCode = headerCode || queryCode || basicPassword;

  if (providedCode !== expectedCode) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Swagger"');
    res.status(401).json({
      success: false,
      message:
        "Acesso negado ao Swagger. Envie x-swagger-code válido, ?code=... ou Basic Auth.",
    });
    return;
  }

  next();
}
