import z from "zod";

export const TimelineQuerySchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().uuid().optional().nullable(),
});

export const ForYouQuerySchema = TimelineQuerySchema; // same params for now
