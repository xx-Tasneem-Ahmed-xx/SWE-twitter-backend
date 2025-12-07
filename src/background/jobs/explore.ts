import { exploreQueue } from "../queues";
import { ExploreJobData, TweetScoreUpdate } from "../types/jobs";

export const FEED_CACHE_PREFIX = "user:exploreFeed:"; // Redis key prefix
export const FEED_CACHE_TTL = 0.5 * 60 * 60; // half an hour
const REFRESH_RATE_IN_HOURS = 0.5 * 60 * 60 * 1000;

export async function enqueueUpdateScroeJob(payload: TweetScoreUpdate) {
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

export async function enqueueRefreshFeedJob(payload: ExploreJobData) {
  await exploreQueue.add("refresh-feed", payload, {
    attempts: 1,
    removeOnComplete: 500,
    removeOnFail: 200,
    priority: 5,
    jobId: `refresh:${payload.userId}`,
    delay: REFRESH_RATE_IN_HOURS,
  });
}
