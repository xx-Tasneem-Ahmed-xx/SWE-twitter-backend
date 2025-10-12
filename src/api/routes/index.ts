import express, { Router, Request, Response, NextFunction } from "express";

// Assuming userRoutes is an Express Router instance
import userRoutes from "./userRoutes.js"; 

// GeoGurd is a default-exported middleware function
import GeoGurd from "../middlewares/GeoGuard.js";

// Define the type for an Express Middleware function
type MiddlewareFunction = (req: Request, res: Response, next: NextFunction) => Promise<any> | void;

// Type assertion for GeoGurd
const typedGeoGurd = GeoGurd as unknown as MiddlewareFunction;

const router: Router = express.Router();

// Mount user-related routes under the '/auth' path
router.use("/auth", userRoutes);

// Apply the GeoGuard middleware to all subsequent routes (or the entire application if this is the main router)
router.use(typedGeoGurd);

export default router;