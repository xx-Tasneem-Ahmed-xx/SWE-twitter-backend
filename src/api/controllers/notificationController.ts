import {Request, Response} from 'express';
import { prisma } from '@/prisma/client';
import { NotificationInputSchema } from '@/application/dtos/notification/notification.dto.schema';
import { socketService } from '../../app';
export const getNotificationList = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const notifications = await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        return res.status(200).json({ notifications });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}


export const getUnseenNotificationsCount = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const unseenCount = await prisma.notification.count({
            where: { userId, isRead: false },
            orderBy: { createdAt: 'desc' },
        });
        return res.status(200).json({ unseenCount });
    } catch (error) {
        console.error('Error fetching unseen notifications count:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

export const getUnseenNotifications = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const unseenNotifications = await prisma.notification.findMany({
            where: { userId, isRead: false },
            orderBy: { createdAt: 'desc' },
        });
        return res.status(200).json({ unseenNotifications });
    } catch (error) {
        console.error('Error fetching unseen notifications:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}


export const markNotificationsAsRead = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        const notificationId = req.params.NotificationId;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const updatedNotification = await prisma.notification.update({
            where: { id: notificationId },
            data: { isRead: true },
        });
        if(!updatedNotification){
            return res.status(404).json({ error: 'Notification not found' });
        }
        return res.status(200).json({ message: 'Notification marked as read', notification: updatedNotification });
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

export const addNotification = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const notificationData = NotificationInputSchema.parse(req.body);
        if (!notificationData) {
            return res.status(400).json({ error: 'Invalid notification data' });
        }
        const newNotification = await prisma.notification.create({
            data: {
                userId,
                type: notificationData.type as any,
                content: notificationData.content,
                tweetId: notificationData.tweetId,
                actorId: notificationData.actorId,
                isRead: false,
            }
        });
        socketService.sendNotificationToUser(userId, newNotification);
        return res.status(201).json({ notification: newNotification });
    } catch (error) {
        console.error('Error adding notification:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}