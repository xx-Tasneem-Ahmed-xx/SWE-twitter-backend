import { NotificationTitle } from "@prisma/client";

export type HashtagJobData = {
  tweetId: string;
  content: string;
};

export type TrendUpdateJobData = {
  periodHours: number;
};

export type ExploreJobData = {
  tweetId: string;
};

export type NotificationJobData = {
  recipientId: string;
  title: NotificationTitle;
  tweetId?: string;
};
