import { Worker } from "bullmq";
import { bullRedisConfig } from "@/background/config/redis";
import { attachHashtagsToTweet } from "@/application/services/hashtags";
import { prisma } from "@/prisma/client";
import type { HashtagJobData } from "@/background/types/jobs";
import { loadSecrets } from "@/config/secrets";
import { initRedis } from "@/config/redis";

async function startWorker() {
  await initRedis();
  await loadSecrets();

  const hashtagWorker = new Worker<HashtagJobData>(
    "hashtags",
    async (job) => {
      const { tweetId, content } = job.data;

      const tweetExists = await prisma.tweet.findUnique({
        where: { id: tweetId },
        select: { id: true },
      });

      if (!tweetExists) {
        throw new Error(
          `Tweet ${tweetId} not found (attempt ${job.attemptsMade + 1}/${
            job.opts.attempts || 3
          }) - transaction may not be committed yet`
        );
      }

      switch (job.name) {
        case "extract": {
          await prisma.$transaction(async (tx) => {
            await attachHashtagsToTweet(tweetId, content, tx);
          });

          break;
        }

        case "categorize-tweet": {
          const { default: tweetService } = await import(
            "@/application/services/tweets"
          );

          await prisma.$transaction(async (tx) => {
            await tweetService.categorizeTweet(tweetId, content, tx);
          });

          break;
        }

        default:
          throw new Error(`Unknown job: ${job.name}`);
      }
    },
    {
      connection: bullRedisConfig,
      concurrency: 8,
    }
  );

  hashtagWorker.on("completed", (job) => {
    console.log(
      `[hashtags.worker] completed ${job.name} : ${job.id} tweetId=${job.data.tweetId}`
    );
  });

  hashtagWorker.on("failed", (job, err) => {
    console.error(`[hashtags.worker] failed job ${job?.id}`, err);
  });

  hashtagWorker.on("error", (err) => {
    console.error("[hashtags.worker] worker error", err);
  });
}

startWorker().catch((err) => {
  console.error("[hashtags.worker] failed to start", err);
  process.exit(1);
});
