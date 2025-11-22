import dotenv from "dotenv";
dotenv.config();

import httpServer from "@/app";
import { connectToDatabase, disconnectFromDatabase } from "@/database";
import "module-alias/register";
import { connectRedis } from "./config/redis";
import { getKey } from "./application/services/secrets";
import { initEncoderService } from "./application/services/encoder";

async function start() {
  try {
    console.log("Starting server...");

    await connectRedis();
    console.log("Redis connected");
    
    const portValue = await getKey("PORT");
    const PORT = portValue ? Number(portValue) : 3000;

    await connectToDatabase();
    console.log("Database connected");


    await initEncoderService();

    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API available at http://localhost:${PORT}`);
      console.log(`Socket.IO server ready for connections`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  console.log(`\nShutting down gracefully (${signal})...`);
  await disconnectFromDatabase();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start();