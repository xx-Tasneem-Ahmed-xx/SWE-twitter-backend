import { Worker } from "bullmq";
import { bullRedisConfig } from "@/background/config/redis";
import { loadSecrets } from "@/config/secrets";
import { initRedis } from "@/config/redis";
import { ExploreJobData, TweetScoreUpdate } from "../types/jobs";
import { enqueueRefreshFeedJob } from "../jobs/explore";

async function startWorker() {
  await initRedis();
  await loadSecrets();
  const exploreWorker = new Worker<TweetScoreUpdate | ExploreJobData>(
    "explore",
    async (job) => {
      const { ExploreService } = await import("@/application/services/explore");
      const exploreService = ExploreService.getInstance();
      switch (job.name) {
        case "update-score": {
          if ("tweetId" in job.data)
            await exploreService.calculateTweetScore(job.data.tweetId);

          break;
        }
        case "refresh-feed": {
          if ("userId" in job.data) {
            const userId = job.data.userId;
            await exploreService.getFeed({
              userId,
              limit: 50,
              forceRefresh: true,
            });
            await enqueueRefreshFeedJob({ userId });
          }
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
    console.log(`completed ${job.name} : ${job.id}`);
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
