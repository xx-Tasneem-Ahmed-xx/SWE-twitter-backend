import { notificationsQueue } from "../queues/index";
import type { NotificationJobData } from "../types/jobs";

export const enqueueNewNotificationJob = async (
  payload: NotificationJobData,
  key: string
) => {
  await notificationsQueue.add("flushNotifications", payload, {
    delay: 5000,
    jobId: `${key}`,
    removeOnComplete: true,
    removeOnFail: true,
  });
};
