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
    delay: 0,
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
