import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { MediaType, MessageStatus, NotificationTitle } from "@prisma/client";
extendZodWithOpenApi(z);

export const NotificationSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(NotificationTitle),
  content: z.string().max(280),
  isRead: z.boolean().default(false),
  createdAt: z.date().default(new Date()),
  userId: z.string().uuid(),
  tweetId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
});

export const NotificationInputSchema = z.object({
  type: z.enum(NotificationTitle),
  content: z.string().max(280),
  tweetId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
});
