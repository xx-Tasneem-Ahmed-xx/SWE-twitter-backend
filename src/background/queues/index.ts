import { Queue, QueueOptions } from "bullmq";
import { bullRedisConfig } from "@/background/config/redis";

function createQueue(name: string, options: Partial<QueueOptions> = {}) {
  return new Queue(name, {
    connection: bullRedisConfig,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: true,
      removeOnFail: false,
      ...options.defaultJobOptions,
    },
  });
}

export const hashtagsQueue = createQueue("hashtags");
export const trendsQueue = createQueue("trends");
export const exploreQueue = createQueue("explore");
export const notificationsQueue = createQueue("notifications");
export const emailQueue = createQueue("emails");