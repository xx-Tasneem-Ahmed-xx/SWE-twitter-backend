import { prisma } from "@/prisma/client";
import { exploreQueue } from "@/background/queues/index";
import {
  SeedExploreFeedJobData,
  TweetScoreUpdate,
} from "@/background/types/jobs";

export async function enqueueUpdateScoreJob(payload: TweetScoreUpdate) {
  await exploreQueue.add("update-score", payload, {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 3000,
    },
    delay: 5000,
    lifo: false,
    removeOnComplete: { age: 3600, count: 100 },
    removeOnFail: { age: 86400, count: 500 },
  });
}

export async function enqueueSeedExploreFeedJob(
  payload: SeedExploreFeedJobData
) {
  await exploreQueue.add("seed-explore-feed", payload, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 3000,
    },
    removeOnComplete: true,
    removeOnFail: true,
  });
}

export async function seedExploreCache() {
  const allTweets = await prisma.tweet.findMany({
    select: { id: true },
  });

  const tweetIds = allTweets.map((t) => t.id);

  await enqueueSeedExploreFeedJob({ tweetIds });

  console.log(`Enqueued seed job for ${tweetIds.length} tweets`);
}
