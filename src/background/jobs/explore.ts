import { exploreQueue } from "../queues";
import { ExploreJobData } from "../types/jobs";

export async function enqueueUpdateScroeJob(payload: ExploreJobData) {
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
