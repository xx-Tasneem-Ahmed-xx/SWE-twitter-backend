import { NextFunction, Request, Response } from "express";
import { prisma } from "@/prisma/client";
import { NotificationInputSchema } from "@/application/dtos/notification/notification.dto.schema";
import { socketService } from "../../app";
import { sendPushNotification } from "@/application/services/FCMService";
import { UUID } from "crypto";
import { z } from "zod";
import { NotificationTitle } from "@prisma/client";
import { AppError } from "@/errors/AppError";
import type { NotificationJobData } from "@/background/types/jobs";
import { redisClient } from "@/config/redis";
import { enqueueNewNotificationJob } from "@/background/jobs/notificationsJob";
import {
  addNotification,
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
      throw new AppError("Unauthorized", 401);
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
      throw new AppError("Unauthorized", 401);
    }

    const unseenCount = user.unseenNotificationCount || 0;
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
      throw new AppError("Unauthorized", 401);
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

export const markNotificationsAsRead = async (notificationId: string) => {
  try {
    const userId = (
      await prisma.notification.findUnique({
        where: { id: notificationId },
        select: { userId: true },
      })
    )?.userId;
    const updatedNotification = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
    if (updatedNotification) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          unseenNotificationCount: {
            decrement: 1,
          },
        },
      });
    }
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

    await addNotification(recipientId, notificationData);

    res.status(200).json({ message: "Notification sent successfully" });
  } catch (error) {
    next(error);
  }
};