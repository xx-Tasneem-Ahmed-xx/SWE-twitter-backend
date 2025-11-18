import z from "zod";
import {
  CreateTweetDTOSchema,
  SearchDTOSchema,
  TimelineSchema,
} from "@/application/dtos/tweets/tweet.dto.schema";

export const createTweetServiceSchema = CreateTweetDTOSchema.extend({
  userId: z.uuid(),
});

export const createReTweetServiceSchema = z.object({
  userId: z.uuid(),
  parentId: z.uuid(),
});

export const CreateReplyOrQuoteServiceSchema = CreateTweetDTOSchema.extend({
  userId: z.uuid(),
  parentId: z.uuid(),
});

export const TimelineServiceSchema = TimelineSchema.extend({
  userId: z.uuid(),
});

export const SearchServiceSchema = SearchDTOSchema.extend({ userId: z.uuid() });

//TODO: EDIT THE NAMINGS
export const BaseCursorSchema = z.object({
  userId: z.uuid(),
  createdAt: z.coerce.date(),
  limit: z.coerce.number().min(1).max(40).default(20),
});

export const CursorServiceSchema = BaseCursorSchema.extend({
  cursor: z
    .object({ lastActivityAt: z.coerce.date(), id: z.uuid() })
    .optional(),
});
