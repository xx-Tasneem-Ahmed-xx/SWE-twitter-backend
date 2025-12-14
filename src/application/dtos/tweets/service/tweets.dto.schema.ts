import z from "zod";
import {
  CreateTweetDTOSchema,
  SearchDTOSchema,
  TimelineSchema,
  UpdateTweetSchema,
} from "@/application/dtos/tweets/tweet.dto.schema";
import { TweetType } from "@prisma/client";

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

export const UpdateTweetServiceSchema = UpdateTweetSchema.safeExtend({
  userId: z.uuid(),
});

export const TimelineServiceSchema = TimelineSchema.extend({
  userId: z.uuid(),
});

export const SearchServiceSchema = SearchDTOSchema.extend({
  userId: z.uuid(),
  cursor: z.object({ id: z.uuid() }).optional(),
});

const CursorServiceSchema = z.object({
  userId: z.uuid(),
  limit: z.coerce.number().min(1).max(40).default(20),
});

export const TweetCursorServiceSchema = CursorServiceSchema.extend({
  tweetType: z.enum(TweetType).optional(),
  cursor: z.object({ createdAt: z.coerce.date(), id: z.uuid() }).optional(),
});

export const InteractionsCursorServiceSchema = CursorServiceSchema.extend({
  cursor: z.object({ createdAt: z.coerce.date(), userId: z.uuid() }).optional(),
});
