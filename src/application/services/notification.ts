import { socketService } from "@/app";
import { sendPushNotification } from "./FCMService";
import { prisma } from "@/prisma/client";
import { NotificationTitle } from "@prisma/client";

export const sendOverSocket = (
  recipientId: string,
  notification: any
) => {
  const isActive: boolean = socketService.checkSocketStatus(recipientId);
  if (isActive) {
    socketService?.sendNotificationToUser(recipientId, notification);
  }
};

export const sendOverFCM = async (recipientId: string, title: NotificationTitle, body: string, dataPayload: any) => {
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
