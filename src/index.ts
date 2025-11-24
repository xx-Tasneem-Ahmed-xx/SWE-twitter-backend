// index.ts
import dotenv from "dotenv";
dotenv.config();

import "module-alias/register";
import { connectToDatabase } from "@/database";
import { connectRedis } from "./config/redis";
import { loadSecrets, getSecrets } from "@/config/secrets";
import { initEncoderService } from "./application/services/encoder";

async function start() {
  await connectRedis();
  console.log("Redis connected");

  await loadSecrets(); // load secrets here
  console.log("Secrets loaded");

  const port = getSecrets().PORT ?? 3000;

  await connectToDatabase();
  console.log("Database connected");

  await initEncoderService();

  // defer app import until secrets are loaded
  const { default: httpServer } = await import("@/app");  
  httpServer.listen(port, () => console.log(`Server running on port ${port}`));
}

start();
