import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { MediaType, MessageStatus } from "@prisma/client";
import { NotificationTitle } from "@prisma/client";
extendZodWithOpenApi(z);

export const NotificationSchema = z.object({
    id: z.string().uuid(),
    title: z.enum(NotificationTitle),
    body: z.string().max(280),
    isRead: z.boolean().default(false),
    createdAt: z.date().default(new Date()),
    userId: z.string().uuid(),
    tweetId: z.string().uuid().optional(),
    actorId: z.string().uuid().optional(),
    actor: z.object({
        name: z.string(),
        profileMediaId: z.string().uuid().nullable(),
    })
})


export const NotificationInputSchema = z.object({
    title: z.enum(NotificationTitle),
    body: z.string().max(280),
    tweetId: z.string().uuid().optional(),
    actorId: z.string().uuid().optional(),
})