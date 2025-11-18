import { Worker } from "bullmq";
import { bullRedisConfig } from "@/background/config/redis";
import { calculateAndCacheTrends } from "@/application/services/hashtags";
import type { TrendUpdateJobData } from "@/background/types/jobs";

// Trends calculation worker
const trendsWorker = new Worker<TrendUpdateJobData>(
  "trends",
  async (job) => {
    const { periodHours } = job.data;

    console.log(
      `[trends.worker] Starting trend calculation for ${periodHours} hours`
    );

    await calculateAndCacheTrends(periodHours);

    return;
  },
  {
    connection: bullRedisConfig,
    concurrency: 1, // Only one trend calculation at a time
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
