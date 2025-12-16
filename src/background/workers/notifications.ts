import { Worker } from "bullmq";
import { redisClient, initRedis } from "../../config/redis";
import { bullRedisConfig } from "../config/redis";
import { prisma } from "@/prisma/client";
import { loadSecrets } from "@/config/secrets";
import { sendSSEMessage } from "@/application/services/ServerSideEvents";

async function startWorker() {
  await initRedis();
  await loadSecrets();

  const { sendOverSocket, sendOverFCM } = await import(
    "../../application/services/notification"
  );

  enum notificationBodies {
    LIKE = "liked your post",
    REPLY = "replied to your post",
    RETWEET = "reposted your post",
    QUOTE = "quoted your post",
    MENTION = "mentioned you",
  }

  const worker = new Worker(
    "notifications",
    async (job) => {
      const { recipientId, title, tweetId } = job.data;
      const key = `notifications:${recipientId}-${title}-tweet:${tweetId}`;

      const items = await redisClient.lRange(key, 0, -1);
      if (items.length === 0) {
        return;
      }
      let newNotification;
      if (items.length === 1) {
        const notification = JSON.parse(items[0]);
        newNotification = await prisma.notification.create({
          data: notification,
          include: {
            actor: {
              select: {
                id: true,
                name: true,
                username: true,
                profileMediaId: true,
              },
            },
          },
        });
      } else {
        const notifications = items.map((x) => JSON.parse(x));
        const firstActor = await prisma.user.findUnique({
          where: { id: notifications[0].actorId },
          select: {
            id: true,
            name: true,
            username: true,
            profileMediaId: true,
          },
        });
        const aggregatedNotification = {
          userId: recipientId,
          title: title,
          body: `${firstActor?.name} + ${notifications.length - 1} others ${
            notificationBodies[title as keyof typeof notificationBodies]
          }`,
          tweetId: notifications[0].tweetId,
          actorId: firstActor?.id!,
          isRead: false,
        };
        newNotification = await prisma.notification.create({
          data: aggregatedNotification,
          include: {
            actor: {
              select: {
                id: true,
                name: true,
                username: true,
                profileMediaId: true,
              },
            },
          },
        });
      }
      sendOverSocket(recipientId, newNotification);
      await sendOverFCM(
        recipientId,
        newNotification.title,
        newNotification.body,
        { newNotification }
      );
      await redisClient.del(key);
    },
    { connection: bullRedisConfig }
  );
  worker.on("completed", (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Job ${job?.id} failed:`, err);
  });
}

startWorker().catch((err) => {
  console.error("Worker (notifications) failed to start:", err);
  throw err;
});
