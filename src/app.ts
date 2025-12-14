import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import swaggerUi from "swagger-ui-express";
import swaggerDoc from "./docs/index";
import { createServer, get } from "http";
import { Server as SocketIOServer } from "socket.io";
import { SocketService } from "@/application/services/socketService";
import ChatRouter from "@/api/routes/chatRoutes";
import notificationRoutes from "@/api/routes/notificationRoutes";
import mediaRouter from "@/api/routes/media";
import tweetRoutes from "@/api/routes/tweets";
import exploreRoutes from "@/api/routes/explore";
import timelineRoutes from "@/api/routes/timeline";
import userInteractionsRoutes from "@/api/routes/userInteractions";
import userRouter from "@/api/routes/user.routes";
import hashtagsRoutes from "@/api/routes/hashtags";
import { errorHandler } from "@/api/middlewares/errorHandler";
import authRoutes from "@/api/routes/authRoutes";
import Auth from "@/api/middlewares/Auth";
import oauthRoutes from "./api/routes/oauthRoutes";
import { S3Client } from "@aws-sdk/client-s3";
import { StorageSystem } from "@/application/services/storeageSystem";
import {
  admin,
  initializeFirebase,
} from "./application/services/firebaseInitializer";
import cookieParser from "cookie-parser";
// import { initializeSearchEngine } from "./api/controllers/SearchEngine";
import { no } from "zod/v4/locales";
import {
  Crawler,
  Parser,
  Indexer,
  SearchEngine,
} from "./api/controllers/SearchEngine";
// Type assertion for GeoGurd
import { apiRoutes } from "./api/routes/searchRoutes";
import { getKey } from "./application/services/secrets";
import { SSErequest } from "./application/services/ServerSideEvents";
const app = express();
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(compression());
app.use(express.json());
app.use(cookieParser());

initializeFirebase();

const httpServer = createServer(app);
export const io: SocketIOServer = new SocketIOServer(httpServer, {
  cors: {
    origin: "http://localhost:5173", // Replace with your React app's URL
    methods: ["GET", "POST"],
  },
});

const s3 = new S3Client({
  region: async () => (await getKey("AWS_REGION")) ?? "us-east-1",
});
const storageService = new StorageSystem(s3);
export { storageService };

const socketService = new SocketService(io);
export { socketService };
import { initializeSearchEngine } from "./api/search/initialize";
import { twitterSearchRoutes } from "./api/routes/search.routes";
// src/api/routes/search.routes.ts
initializeSearchEngine()
  .then(({ crawler, parser, indexer, searchEngine, persistence }) => {
    app.use('/api', twitterSearchRoutes(crawler, parser, indexer, searchEngine, persistence));
  })
  .catch((err) => {
    console.error('Failed to initialize search engine:', err);
  });
  // app.ts or server.ts

import { initializeChatSearchEngine } from "@/chat/search/initializeChatSearch";
import { chatSearchRoutes } from "@/api/routes/chatSearch.routes";


initializeChatSearchEngine()
  .then(
    ({
      chatCrawler,
      chatParser,
      chatIndexer,
      chatSearchEngine,
      chatPersistence,
    }) => {
      app.use(
        "/api",
        chatSearchRoutes(
          chatCrawler,
          chatParser,
          chatIndexer,
          chatSearchEngine,
          chatPersistence
        )
      );

      console.log("✅ Chat search routes initialized");
    }
  )
  .catch((err) => {
    console.error("❌ Failed to initialize chat search engine:", err);
  });

// initializeSearchEngine()
//   .then(({ crawler, parser, indexer, searchEngine, persistence }) => {
//     app.use('/api', apiRoutes(crawler, parser, indexer, searchEngine, persistence));
//   })
//   .catch((err) => {
//     console.error('Failed to initialize search engine:', err);
//   });
// initializeSearchEngine()
//   .then(({ crawler, parser, indexer, searchEngine, persistence }) => {
//     app.use('/api', twitterSearchRoutes(crawler, parser, indexer, searchEngine, persistence));
//   })
//   .catch((err) => {
//     console.error('Failed to initialize search engine:', err);
//   });
//   initializeSearchEngine()
//   .then(({ crawler, parser, indexer, searchEngine, persistence }) => {
//     app.use('/api', chatSearchRoutes( parser, indexer, searchEngine, persistence));
//   })
//   .catch((err) => {
//     console.error('Failed to initialize search engine:', err);
//   });

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));
app.get('/events/:userId', SSErequest);
app.use("/api/auth", authRoutes);
app.use("/oauth2", oauthRoutes);
app.use(Auth());

 
app.use("/api/dm", ChatRouter);
app.use("/api/media", mediaRouter);
app.use("/api/notifications", notificationRoutes);

app.use("/api/tweets", tweetRoutes);
app.use("/api/home", timelineRoutes);
app.use("/api/explore", exploreRoutes);
app.use("/api/users", userRouter);
app.use("/api/hashtags", hashtagsRoutes);
app.use("/api", userInteractionsRoutes);


app.get("/", (req, res) => res.json({ message: "HELLO TEAM" }));
app.use(errorHandler);

export default httpServer;
export { app };
