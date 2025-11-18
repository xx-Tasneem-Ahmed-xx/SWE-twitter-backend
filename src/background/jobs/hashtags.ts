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
      pattern: "*/30 * * * *", // Every 30 minutes (cron format)
    },
  });
}
