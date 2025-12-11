import { socketService } from "@/app";
import { sendPushNotification } from "./FCMService";
import { prisma } from "@/prisma/client";
import { NotificationTitle } from "@prisma/client";
import { enqueueNewNotificationJob } from "@/background/jobs/notificationsJob";
import { NotificationJobData } from "@/background/types/jobs";
import { NotificationInputSchema } from "../dtos/notification/notification.dto.schema";
import z from "zod";
import { redisClient } from "@/config/redis";

export const sendOverSocket = (recipientId: string, notification: any) => {
  const isActive: boolean = socketService.checkSocketStatus(recipientId);
  if (isActive) {
    socketService?.sendNotificationToUser(recipientId, notification);
  }
};

export const sendOverFCM = async (
  recipientId: string,
  title: NotificationTitle,
  body: string,
  dataPayload: any
) => {
  const userFCMTokens = await prisma.fcmToken.findMany({
    where: { userId: recipientId },
  });
  const fcmTokens =
    userFCMTokens.length > 0 ? userFCMTokens.map((t) => t.token).flat() : [];

  if (fcmTokens && fcmTokens.length > 0) {
    const notificationPayload = {
      title: title,
      body: body,
    };
    const tokensToDelete = await sendPushNotification(
      fcmTokens,
      notificationPayload,
      dataPayload
    );
    if (tokensToDelete.length > 0) {
      await prisma.fcmToken.deleteMany({
        where: {
          token: { in: tokensToDelete },
        },
      });
    }
  }
};

export const addNotification = async (
  recipientId: string,
  data: z.infer<typeof NotificationInputSchema>
) => {
  const systemRelevantTitles: NotificationTitle[] = [
    NotificationTitle.PASSWORD_CHANGED,
    NotificationTitle.LOGIN,
  ];
  const tweetRelevantTitles: NotificationTitle[] = [
    NotificationTitle.MENTION,
    //NotificationTitle.REPLY,
    NotificationTitle.RETWEET,
    NotificationTitle.LIKE,
    //NotificationTitle.QUOTE,
  ];

  if (systemRelevantTitles.includes(data.title as NotificationTitle)) {
    let body: string;
    const user = await prisma.user.findUnique({
      where: { id: recipientId },
    });

    // Handle system notifications
    if (data.title === NotificationTitle.PASSWORD_CHANGED) {
      body = "Your password has been changed successfully.";
    } else {
      body = `There was a login to your account @${
        user?.username
      } from a new device on ${new Date().toLocaleString()}.`;
    }

    const newNotification = await prisma.notification.create({
      data: {
        userId: recipientId,
        title: data.title as NotificationTitle,
        body: body,
        isRead: false,
      },
    });

    sendOverSocket(recipientId, newNotification);
    await sendOverFCM(
      recipientId,
      data.title as NotificationTitle,
      body,
      newNotification
    );
  } else {
    const actor = await prisma.user.findUnique({
      where: { id: data.actorId },
      select: { id: true, name: true, username: true, profileMediaId: true },
    });

    const newNotification = {
      userId: recipientId,
      title: data.title as NotificationTitle,
      body: data.body,
      tweetId: data.tweetId,
      actorId: data.actorId,
      isRead: false,
    };

    if (tweetRelevantTitles.includes(data.title as NotificationTitle)) {
      const key = `notifications:${recipientId}-${data.title}-tweet:${data.tweetId}`;
      await redisClient.lPush(key, JSON.stringify(newNotification));

      const jobData: NotificationJobData = {
        recipientId,
        title: data.title as NotificationTitle,
        tweetId: data.tweetId ? data.tweetId : undefined,
      };
      await enqueueNewNotificationJob(jobData, key);
    } else {
      // Immediate notifications that are not tweet-relevant
      const createdNotification = await prisma.notification.create({
        data: newNotification,
        include: {
          actor: {
            select: {
              name: true,
              profileMediaId: true,
              username: true,
              id: true,
            },
          },
        },
      });
      sendOverSocket(recipientId, createdNotification);
      await sendOverFCM(
        recipientId,
        data.title as NotificationTitle,
        data.body,
        { createdNotification }
      );
    }
  }

  const updatedUser = await prisma.user.update({
      where: { id: recipientId },
      data: { unseenNotificationCount: { increment: 1 } },

    });
    socketService.sendUnseenNotificationsCount(
      recipientId,
      updatedUser.unseenNotificationCount || 0
    );
};
