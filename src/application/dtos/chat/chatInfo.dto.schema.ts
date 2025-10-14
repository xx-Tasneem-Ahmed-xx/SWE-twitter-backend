import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { MediaType, MessageStatus } from "@prisma/client";
extendZodWithOpenApi(z);

// User schema for chat participants
export const ChatUserSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  name: z.string().nullable(),
  profilePhoto: z.string().nullable()
}).openapi("ChatUser");

// Media schema for message attachments
export const MediaSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  url: z.string().url(),
  type: z.enum(MediaType),
  size: z.number().nullable()
}).openapi("Media");

// Message media schema
export const MessageMediaSchema = z.object({
  messageId: z.string().uuid(),
  mediaId: z.string().uuid(),
  media: MediaSchema
}).openapi("MessageMedia");

// Message schema
export const MessageSchema = z.object({
  id: z.string().uuid(),
  chatId: z.string().uuid(),
  userId: z.string().uuid(),
  content: z.string(),
  createdAt: z.string().datetime(),
  status: z.enum(MessageStatus),
  user: ChatUserSchema,
  messageMedia: z.array(MessageMediaSchema)
}).openapi("Message");

// Chat user relation schema
export const ChatUserRelationSchema = z.object({
  id: z.string().uuid(),
  chatId: z.string().uuid(),
  userId: z.string().uuid(),
  user: ChatUserSchema
}).openapi("ChatUserRelation");

// Chat group schema
export const ChatGroupSchema = z.object({
  name: z.string(),
  photo: z.string().nullable(),
  description: z.string().nullable()
}).openapi("ChatGroup");

// Complete chat info schema
export const ChatInfoSchema = z.object({
  id: z.string().uuid(),
  DMChat: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  messages: z.array(MessageSchema),
  chatUsers: z.array(ChatUserRelationSchema),
  chatGroup: ChatGroupSchema.nullable()
}).openapi("ChatInfo");

export const CreateChatInput = z.object({
  DMChat: z.boolean().optional(),
  participant_ids: z.array(z.string().uuid())
}).openapi("CreateChatInput");

export const messageAttachment = z.object({
    name: z.string().optional(),
    url: z.string().url().optional(),
    size: z.number().optional(),
    type: z.string().optional()
});

export const messageData = z.object({
    messageMedia: z.array(messageAttachment).optional(),
    content: z.string().optional()      
})

export const newMessageInput = z.object({
    data: messageData,
    recipientId: z.array(z.string().uuid()).optional(),
    chatId: z.string().uuid().optional()
}).openapi("newMessageInput");

// Export types for TypeScript usage
export type ChatUser = z.infer<typeof ChatUserSchema>;
export type Media = z.infer<typeof MediaSchema>;
export type MessageMedia = z.infer<typeof MessageMediaSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type ChatUserRelation = z.infer<typeof ChatUserRelationSchema>;
export type ChatGroup = z.infer<typeof ChatGroupSchema>;
export type ChatInfo = z.infer<typeof ChatInfoSchema>;
