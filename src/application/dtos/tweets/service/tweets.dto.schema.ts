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
