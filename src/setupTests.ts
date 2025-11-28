import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });

import { initRedis } from "@/config/redis";
import { loadSecrets } from "@/config/secrets";

beforeAll(async () => {
  await initRedis();
  await loadSecrets();
});
