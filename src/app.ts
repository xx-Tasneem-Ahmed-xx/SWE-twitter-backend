import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import swaggerUi from "swagger-ui-express";
import swaggerDoc from "./docs/index";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { SocketService } from "@/application/services/socketService";
import directMessagesRouter from "@/api/routes/directMessages";
import mediaRouter from "@/api/routes/media";
import tweetRoutes from "@/api/routes/tweets";
import userInteractionsRoutes from "@/api/routes/userInteractions";
import userRouter from "@/api/routes/user.routes";
import { errorHandler } from "@/api/middlewares/errorHandler";
import authRoutes from "@/api/routes/authRoutes";
import Auth from "@/api/middlewares/Auth";
import oauthRoutes from "./api/routes/oauthRoutes";
import fs from "fs";
import {
  Request,
  ParamsDictionary,
  Response,
  NextFunction,
} from "express-serve-static-core";
import { ParsedQs } from "qs";

// Type assertion for GeoGurd

const app = express();
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(compression());
app.use(express.json());

// Create HTTP server and Socket.IO server
const httpServer = createServer(app);
export const io: SocketIOServer = new SocketIOServer(httpServer, {
  cors: {
    origin: "http://localhost:5173", // Replace with your React app's URL
    methods: ["GET", "POST"],
  },
});

// Initialize Socket Service
const socketService = new SocketService(io);
export { socketService };

// app.use("/api", userInteractionsRoutes);

// app.use("/api-docs/auth", swaggerUi.serve, (req: Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>, number>, next: NextFunction) => {
//   const authDoc = JSON.parse(fs.readFileSync("./src/doc/authRoutes.json", "utf-8"));
//   swaggerUi.setup(authDoc)(req, res, next);
// });

// // OAuth routes
// app.use("/api-docs/oauth", swaggerUi.serve, (req: Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>, res: Response<any, Record<string, any>, number>, next: NextFunction) => {
//   const oauthDoc = JSON.parse(fs.readFileSync("./src/doc/oauthRoutes.json", "utf-8"));
//   swaggerUi.setup(oauthDoc)(req, res, next);
// });

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));

app.use("/api/auth", authRoutes);
app.use("/oauth2", oauthRoutes);
app.use(Auth());
app.use("/api/dm", directMessagesRouter);
app.use("/api/media", mediaRouter);

app.use("/api/tweets", tweetRoutes);
app.use("/api/users", userRouter);
app.get("/", (req, res) => res.json({ message: "HELLO TEAM" }));
app.use(errorHandler);
export default httpServer;
export { app };
