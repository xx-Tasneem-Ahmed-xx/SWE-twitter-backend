import { hashtagsQueue } from "@/background/queues/index";
import type { HashtagJobData } from "@/background/types/jobs";

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
