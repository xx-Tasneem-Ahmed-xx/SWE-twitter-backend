import { NextFunction, Request, Response } from "express";
import { prisma } from "@/prisma/client";
import { NotificationInputSchema } from "@/application/dtos/notification/notification.dto.schema";
import * as responseUtils from "@/application/utils/response.utils";
import { socketService } from "../../app";
import { sendPushNotification } from "@/application/services/FCMService";
import { UUID } from "crypto";
import { z } from "zod";
import { NotificationTitle } from "@prisma/client";
import { AppError } from "@/errors/AppError";
import { notificationsQueue } from "@/background/queues";
import type { NotificationJobData } from "@/background/types/jobs";
import { redisClient } from "@/config/redis";
import { enqueueNewNotificationJob } from "@/background/jobs/notificationsJob";
import {
  sendOverFCM,
  sendOverSocket,
} from "@/application/services/notification";

export const getNotificationList = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      responseUtils.throwError("UNAUTHORIZED_ACCESS");
    }
    await prisma.user.update({
      where: { id: userId },
      data: { unseenNotificationCount: 0 },
    });
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        actor: {
          select: {
            name: true,
            profileMediaId: true,
          },
        },
      },
      take: 50,
    });
    return res.status(200).json({ notifications });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    next(error);
  }
};

export const getMentionNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user.id;
    await prisma.user.update({
      where: { id: userId },
      data: { unseenNotificationCount: 0 },
    });
    const mentionNotifications = await prisma.notification.findMany({
      where: { userId, title: NotificationTitle.MENTION},
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json({ mentionNotifications });
  } catch (error) {
    console.error("Error fetching mention notifications:", error);
    next(error);
  }
};

export const getUnseenNotificationsCount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      responseUtils.throwError("UNAUTHORIZED_ACCESS");
    }

    const unseenCount = user!.unseenNotificationCount || 0;
    return res.status(200).json({ unseenCount });
  } catch (error) {
    next(error);
  }
};

export const getUnseenNotifications = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user.id;
    if (!userId) {
      responseUtils.throwError("UNAUTHORIZED_USER");
    }
    await prisma.user.update({
      where: { id: userId },
      data: { unseenNotificationCount: 0 },
    });
    const unseenNotifications = await prisma.notification.findMany({
      where: { userId, isRead: false },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json({ unseenNotifications });
  } catch (error) {
    console.error("Error fetching unseen notifications:", error);
    next(error);
  }
};

export const markNotificationsAsRead = async (userId: string) => {
  try {
   
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    await prisma.user.update({
      where: { id: userId },
      data: {
        unseenNotificationCount: 0
      },
    });
    socketService.sendUnseenNotificationsCount(
      userId,
      0
    );
    return;
  } catch (error) {
    console.error("Error marking notifications as read:", error);
    return error;
  }
};

export const addNotificationController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const recipientId = req.params.recipientId;
    const notificationData = req.body;
    const data = NotificationInputSchema.parse(notificationData);
    const systemRelevantTitles: NotificationTitle[] = [
      NotificationTitle.PASSWORD_CHANGED,
      NotificationTitle.LOGIN,
    ];
    const tweetRelevantTitles: NotificationTitle[] = [
      NotificationTitle.MENTION,
      NotificationTitle.REPLY,
      NotificationTitle.RETWEET,
      NotificationTitle.LIKE,
      NotificationTitle.QUOTE,
    ];
    if (systemRelevantTitles.includes(data.title as NotificationTitle)) {
      let body: string;
      const user = await prisma.user.findUnique({
        where: { id: recipientId },
      });
      //handle system notifications
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
        //this handle imediate notifications that are not tweet relevant
        const createdNotification = await prisma.notification.create({
          data: newNotification,
          include: {
            actor: {
              select: {
                name: true,
                profileMediaId: true,
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

  } catch (error) {
    next(error);
  }
};
