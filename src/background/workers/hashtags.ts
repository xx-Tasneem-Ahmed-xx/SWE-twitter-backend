import { Worker } from "bullmq";
import { bullRedisConfig } from "@/background/config/redis";
import { attachHashtagsToTweet } from "@/application/services/hashtags";
import { prisma } from "@/prisma/client";
import type { HashtagJobData } from "@/background/types/jobs";

// Hashtag extraction worker
const hashtagWorker = new Worker<HashtagJobData>(
  "hashtags",
  async (job) => {
    const { tweetId, content } = job.data;

    await prisma.$transaction(async (tx) => {
      await attachHashtagsToTweet(tweetId, content, tx);
    });
    return;
  },
  {
    connection: bullRedisConfig,
    concurrency: 5,
  }
);

hashtagWorker.on("completed", (job) => {
  console.log(
    `[hashtags.worker] completed job ${job.id} tweetId=${job.data.tweetId}`
  );
});
hashtagWorker.on("failed", (job, err) => {
  console.error(`[hashtags.worker] failed job ${job?.id}`, err);
});
hashtagWorker.on("error", (err) => {
  console.error("[hashtags.worker] worker error", err);
});
