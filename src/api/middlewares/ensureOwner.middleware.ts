import { Request, Response, NextFunction } from "express";

export const ensureOwner = (paramName = "id") => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authUserId = (req as any).user?.id;
    const targetId = req.params[paramName];

    if (!authUserId) return res.status(401).json({ message: "Unauthorized" });
    if (!targetId)
      return res.status(400).json({ message: "Missing target id" });

    if (authUserId !== targetId)
      return res
        .status(403)
        .json({ message: "Forbidden: you can only modify your own profile" });

    return next();
  };
};
