import { NotificationInputSchema } from "@/application/dtos/notification/notification.dto.schema";
import { NotificationTitle } from "@prisma/client";


export type HashtagJobData = {
  tweetId: string;
  content: string;
};

export type TrendUpdateJobData = {
  periodHours: number;
};

export type NotificationJobData = {
  recipientId: string;
  title: NotificationTitle;
  tweetId?: string;
};
