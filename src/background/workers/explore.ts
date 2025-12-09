import { Worker } from "bullmq";
import { bullRedisConfig } from "@/background/config/redis";
import { loadSecrets } from "@/config/secrets";
import { initRedis } from "@/config/redis";
import {
  ExploreJobData,
  SeedExploreFeedJobData,
  TweetScoreUpdate,
} from "../types/jobs";
import { ExploreService } from "@/application/services/explore";
import { seedExploreFeeds } from "@/scripts/seedExplore";

async function startWorker() {
  await initRedis();
  await loadSecrets();
  const exploreWorker = new Worker<
    TweetScoreUpdate | ExploreJobData | SeedExploreFeedJobData
  >(
    "explore",
    async (job) => {
      const exploreService = ExploreService.getInstance();
      switch (job.name) {
        case "update-score": {
          if ("tweetId" in job.data)
            await exploreService.calculateTweetScore(job.data.tweetId);

          break;
        }
        case "refresh-category-feed": {
          if ("categoryName" in job.data)
            await exploreService.refreshCategoryFeed(job.data.categoryName);

          break;
        }
        case "seed-explore-feed": {
          if ("tweetIds" in job.data && Array.isArray(job.data.tweetIds))
            await exploreService.seedExploreFeeds(job.data.tweetIds);

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

  await seedExploreFeeds();
}

startWorker().catch((err) => {
  console.error("Failed to start", err);
  process.exit(1);
});
