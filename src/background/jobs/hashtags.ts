import { hashtagsQueue, trendsQueue } from "@/background/queues/index";
import type {
  HashtagJobData,
  TrendUpdateJobData,
} from "@/background/types/jobs";

export async function enqueueHashtagJob(payload: HashtagJobData) {
  await hashtagsQueue.add("extract", payload, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 500 },
  });
}

export async function enqueueCategorizeTweetJob(payload: HashtagJobData) {
  await hashtagsQueue.add("categorize-tweet", payload, {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 3000,
    },
    delay: 0,
    lifo: false,
    removeOnComplete: { age: 3600, count: 500 }, // 1 hour
    removeOnFail: { age: 86400, count: 500 }, // 24 hours
  });
}

export async function enqueueTrendUpdateJob(payload: TrendUpdateJobData) {
  await trendsQueue.add("calculate", payload, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
    repeat: {
      pattern: "*/2 * * * *", // Every 2 minutes (cron format)
    },
  });
}
