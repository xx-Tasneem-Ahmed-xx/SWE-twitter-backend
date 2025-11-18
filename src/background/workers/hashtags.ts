import { Worker } from "bullmq";
import { bullRedisConfig } from "@/background/config/redis";
import { attachHashtagsToTweet } from "@/application/services/hashtags";
import { prisma } from "@/prisma/client";
import type { HashtagJobData } from "@/background/types/jobs";

const worker = new Worker<HashtagJobData>(
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

worker.on("completed", (job) => {
  console.log(
    `[hashtags.worker] completed job ${job.id} tweetId=${job.data.tweetId}`
  );
});
worker.on("failed", (job, err) => {
  console.error(`[hashtags.worker] failed job ${job?.id}`, err);
});
worker.on("error", (err) => {
  console.error("[hashtags.worker] worker error", err);
});
