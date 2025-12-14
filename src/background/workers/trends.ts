import { Worker } from "bullmq";
import { bullRedisConfig } from "@/background/config/redis";
import { TrendingHashtagsAndTweets } from "@/application/services/hashtags";
import type { TrendUpdateJobData } from "@/background/types/jobs";
import { loadSecrets } from "@/config/secrets";
import { initRedis } from "@/config/redis";

async function startWorker() {
  await initRedis();
  await loadSecrets();

  const trendsWorker = new Worker<TrendUpdateJobData>(
    "trends",
    async (job) => {
      const { periodHours } = job.data;

      console.log(
        `[trends.worker] Starting trend calculation for ${periodHours} hours`
      );

      await TrendingHashtagsAndTweets();

      return;
    },
    {
      connection: bullRedisConfig,
      concurrency: 1,
    }
  );

  trendsWorker.on("completed", (job) => {
    console.log(`[trends.worker] completed job ${job.id}`);
  });

  trendsWorker.on("failed", (job, err) => {
    console.error(`[trends.worker] failed job ${job?.id}`, err);
  });

  trendsWorker.on("error", (err) => {
    console.error("[trends.worker] worker error", err);
  });
}

startWorker().catch((err) => {
  console.error("[trends.worker] failed to start", err);
  process.exit(1);
});
