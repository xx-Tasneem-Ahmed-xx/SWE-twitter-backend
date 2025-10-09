import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import swaggerUi from "swagger-ui-express";
import { swaggerDoc } from "./docs";
//import tweetRoutes from "@/api/routes/tweets";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { SocketService } from "./application/services/socketService";
import directMessagesRouter from "./api/routes/directMessages";
//import tweetRoutes from "@/api/routes/tweets";
import userInteractionsRoutes from "./api/routes/userInteractions";

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

app.use("/api", userInteractionsRoutes);

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));

app.use("/api/users/dm", directMessagesRouter);

//app.use("/api/tweets", tweetRoutes);

app.get("/", (req, res) => res.json({ message: "HELLO TEAM" }));

export default httpServer;
export { app };
