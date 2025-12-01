import { NotificationInputSchema } from "@/application/dtos/notification/notification.dto.schema";
import { NotificationTitle } from "@prisma/client";
import type { EmailTemplateType } from "../../application/utils/tweets/emailTemplates";

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







export interface EmailJobData {
  to: string;
  subject: string;
  message: string;
  templateType?: EmailTemplateType;
}