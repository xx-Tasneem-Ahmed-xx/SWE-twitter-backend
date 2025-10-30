import {NextFunction, Request, Response} from 'express';
import { prisma } from '@/prisma/client';
import { NotificationInputSchema } from '@/application/dtos/notification/notification.dto.schema';
import { socketService } from '../../app';
import {sendPushNotification} from '@/application/services/FCMService';
import { UUID } from 'crypto';
import { z } from 'zod';
import { NotificationTitle } from '@prisma/client';
import { AppError } from "@/errors/AppError";


export const getNotificationList = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });
        if (!user) {
            throw new AppError('Unauthorized', 401);
        }
        // Reset unseen notification count
        await prisma.user.update({
            where: { id: userId },
            data: { unseenNotificationCount: 0 },
        });
        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        return res.status(200).json({ notifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        next(error)
    }
}


export const getUnseenNotificationsCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const user = await prisma.user.findUnique({
            where: { id: userId },
        });

        if (!user) {
            throw new AppError('Unauthorized', 401);
        }

        const unseenCount = user.unseenNotificationCount || 0;
        return res.status(200).json({ unseenCount });
    } catch (error) {
        next(error);
    }
}

export const getUnseenNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        if (!userId) {
            throw new AppError('Unauthorized', 401);
        }
        await prisma.user.update({
            where: { id: userId },
            data: { unseenNotificationCount: 0 },
        });
        const unseenNotifications = await prisma.notification.findMany({
            where: { userId, isRead: false },
            orderBy: { createdAt: 'desc' },
        });
        return res.status(200).json({ unseenNotifications });
    } catch (error) {
        console.error('Error fetching unseen notifications:', error);
        next(error);
    }
}


export const markNotificationsAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const notificationId = req.params.NotificationId;
        if (!userId) {
            throw new AppError('Unauthorized', 401);
        }
        const updatedNotification = await prisma.notification.update({
            where: { id: notificationId },
            data: { isRead: true },
        });
        if(!updatedNotification){
            throw new AppError('Notification not found', 404);
        }
        return res.status(200).json({ message: 'Notification marked as read', notification: updatedNotification });
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        next(error);
    }
}

export const addNotification = async (recipientId: UUID, notificationData: z.infer<typeof NotificationInputSchema>, next: NextFunction) => {
    try {
            const data = NotificationInputSchema.parse(notificationData);
            const newNotification = await prisma.notification.create({
                data: {
                    userId: recipientId,
                    title: data.title as NotificationTitle,
                    body: data.body,
                    tweetId: data.tweetId,
                    actorId: data.actorId,
                    isRead: false
                }
            });
            const isActive: boolean = socketService.checkSocketStatus(recipientId);
            if (isActive) {
                socketService?.sendNotificationToUser(recipientId, newNotification);
            }
            else{
                const userFCMTokens = await prisma.fcmToken.findMany({
                    where: { userId: recipientId },
                });
                const fcmTokens = userFCMTokens.length > 0 ? userFCMTokens.map(t => t.token).flat() : [];

                if (fcmTokens && fcmTokens.length > 0) {
                    const notificationPayload = {
                        title: newNotification.title,
                        body: newNotification.body,
                    };
                    const dataPayload = data;
                    const tokensToDelete = await sendPushNotification(fcmTokens, notificationPayload, dataPayload);
                    if (tokensToDelete.length > 0) {
                        await prisma.fcmToken.deleteMany({
                            where: {
                                token: { in: tokensToDelete },
                            },
                        });
                    }
                }
            }
    } catch (error) {
        next(error);
    }
}