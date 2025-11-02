import dotenv from "dotenv";

// Load environment variables as early as possible so modules that run at import
// time (e.g. SDK initializers) can read them.
dotenv.config();

import httpServer from "@/app";
import { connectToDatabase, disconnectFromDatabase } from "@/database";
import "module-alias/register";
// Ensure global Express.Request augmentation (req.user) is loaded for ts-node
//import "./types/express";
import { connectRedis } from "./config/redis";


const PORT = process.env.PORT;

async function start() {
  try {
    console.log("🚀 Starting server...");
    await connectToDatabase();
    await connectRedis();
    httpServer.listen(PORT, () => {
      console.log(`🌟 Server running on port ${PORT}`);
      console.log(`📡 API available at http://localhost:${PORT}`);
      console.log(`🔌 Socket.IO server ready for connections`);
    });
  } catch (error) {
    console.error("💥 Failed to start server:", error);
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  await disconnectFromDatabase();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  await disconnectFromDatabase();
  process.exit(0);
});

start();