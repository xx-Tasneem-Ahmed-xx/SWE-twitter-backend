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
            username: true,
            id: true,
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
    const mentionNotifications = await prisma.notification.findMany({
      where: { userId, title: NotificationTitle.MENTION},
      orderBy: { createdAt: "desc" },
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

