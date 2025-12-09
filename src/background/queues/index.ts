
import { Queue, QueueOptions } from "bullmq";
import { bullRedisConfig } from "../config/redis";

function createQueue(name: string, options: Partial<QueueOptions> = {}) {
  return new Queue(name, {
    connection: bullRedisConfig,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: true,
      removeOnFail: false,
      ...options.defaultJobOptions,
    },
  });
}


export const hashtagsQueue = createQueue("hashtags");
export const trendsQueue = createQueue("trends");
export const notificationsQueue = createQueue("notifications");
export const emailQueue = createQueue("emails"); // Add this
export const searchIndexerQueue = createQueue("search-indexer");