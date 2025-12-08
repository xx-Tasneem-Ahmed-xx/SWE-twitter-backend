import dotenv from "dotenv";
dotenv.config();
require("module-alias/register");

import "module-alias/register";
import { connectToDatabase } from "@/database";
import { initRedis } from "./config/redis";
import { loadSecrets, getSecrets } from "@/config/secrets";
import { initEncoderService } from "./application/services/encoder";

async function start() {
  await initRedis();

  await loadSecrets();
  console.log("Secrets loaded");

  const port = getSecrets().PORT ?? 3000;

  await connectToDatabase();

  await initEncoderService();

  // defer app import until secrets are loaded
  const { default: httpServer } = await import("@/app");
  httpServer.listen(port, () => console.log(`Server running on port ${port}`));
}

start();
