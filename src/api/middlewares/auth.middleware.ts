// src/api/middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; [key: string]: any };
    }
  }
}

interface JwtPayload {
  sub?: string;
  id?: string;
  [k: string]: any;
}

export const requireAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Missing or invalid Authorization header" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const secret = process.env.JWT_SECRET || "devsecret";
    const payload = jwt.verify(token, secret) as JwtPayload;
    const userId = payload.sub || payload.id || payload.userId;
    if (!userId)
      return res.status(401).json({ message: "Invalid token payload" });

    req.user = { id: userId, ...payload };
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};
