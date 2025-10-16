import "module-alias/register";
import dotenv from "dotenv";
import httpServer from "@/app";
import { connectToDatabase, disconnectFromDatabase } from "@/database";
import { connectRedis } from "./config/redis";
dotenv.config();

const PORT = process.env.PORT;

async function start() {
  try {
    console.log("🚀 Starting server...");
    await connectToDatabase();
    await connectRedis();
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API available at http://localhost:${PORT}`);
      console.log(`Socket.IO server ready for connections`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await disconnectFromDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...');
  await disconnectFromDatabase();
  process.exit(0);
});

start();
