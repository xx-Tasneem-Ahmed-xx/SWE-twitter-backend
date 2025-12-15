import { EmailTemplateType } from "@/application/utils/emailTemplates";
import { NotificationTitle } from "@prisma/client";

export type HashtagJobData = {
  tweetId: string;
  content: string;
};

export type TrendUpdateJobData = {
  periodHours: number;
};

export type ExploreJobData = {
  categoryName: string;
};

export type TweetScoreUpdate = {
  tweetId: string;
};

export type SeedExploreFeedJobData = {
  tweetIds: string[];
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