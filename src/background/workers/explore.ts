import { Worker } from "bullmq";
import { bullRedisConfig } from "@/background/config/redis";
import { loadSecrets } from "@/config/secrets";
import { initRedis } from "@/config/redis";
import { ExploreJobData } from "../types/jobs";
import tweetService from "@/application/services/tweets";

async function startWorker() {
  await initRedis();
  await loadSecrets();
  const exploreWorker = new Worker<ExploreJobData>(
    "explore",
    async (job) => {
      switch (job.name) {
        case "update-score": {
          const { tweetId } = job.data;
          await tweetService.calculateTweetScore(tweetId);
          break;
        }

        default:
          break;
      }
    },
    {
      connection: bullRedisConfig,
      concurrency: 8,
    }
  );

  exploreWorker.on("completed", (job) => {
    console.log(`Updated score for tweet ${job.data.tweetId}`);
  });
  exploreWorker.on("failed", (job, err) => {
    console.error(`Failed job ${job?.id}`, err);
  });

  exploreWorker.on("error", (err) => {
    console.error("worker error", err);
  });
}

startWorker().catch((err) => {
  console.error("Failed to start", err);
  process.exit(1);
});
