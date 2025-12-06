import { Worker } from "bullmq";
import { bullRedisConfig } from "@/background/config/redis";
import { prisma } from "@/prisma/client";
import { loadSecrets } from "@/config/secrets";
import { initRedis } from "@/config/redis";
import { ExploreJobData } from "../types/jobs";

const W_LIKES = 0.2;
const W_RETWEETS = 0.5;
const W_QUOTES = 0.5;
const W_REPLIES = 0.3;
const TAU_HOURS = 48;

async function startWorker() {
  await initRedis();
  await loadSecrets();
  const exploreWorker = new Worker<ExploreJobData>(
    "explore",
    async (job) => {
      const { tweetId } = job.data;
      const tweet = await prisma.tweet.findUnique({
        where: { id: tweetId },
        select: {
          createdAt: true,
          likesCount: true,
          retweetCount: true,
          quotesCount: true,
          repliesCount: true,
        },
      });
      if (!tweet) return;

      const ageHours =
        (Date.now() - new Date(tweet.createdAt).getTime()) / (1000 * 60 * 60);

      const score =
        (W_LIKES * tweet.likesCount +
          W_RETWEETS * tweet.retweetCount +
          W_QUOTES * tweet.quotesCount +
          W_REPLIES * tweet.repliesCount) *
        Math.exp(-(ageHours / TAU_HOURS));

      await prisma.tweet.update({
        where: { id: tweetId },
        data: { score },
      });
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
