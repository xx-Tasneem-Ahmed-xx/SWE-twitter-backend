// src/application/dtos/timeline.dto.schema.ts
import z from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
extendZodWithOpenApi(z);

export const CursorDTOSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

export const TimelineItemSchema = z.object({
  id: z.string(),
  content: z.string(),
  userId: z.string(),
  username: z.string(),
  name: z.string().nullable().optional(),
  profileMediaKey: z.string().nullable().optional(),
  createdAt: z.string(),
  likesCount: z.number(),
  retweetCount: z.number(),
  repliesCount: z.number(),
  score: z.number().optional(), // scoring value
  reasons: z.array(z.string()).optional(), // debugging / explainability
});

export const ForYouResponseSchema = z.object({
  user: z.string(),
  recommendations: z.array(TimelineItemSchema),
  nextCursor: z.string().nullable(),
  generatedAt: z.string(),
});

export const TimelineResponseSchema = z.object({
  data: z.array(TimelineItemSchema),
  nextCursor: z.string().nullable(),
});
