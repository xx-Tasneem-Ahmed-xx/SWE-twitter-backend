import z from "zod";
import {
  CreateReplyOrQuoteServiceSchema,
  createReTweetServiceSchema,
  createTweetServiceSchema,
  CursorServiceSchema,
  SearchServiceSchema,
  TimelineServiceSchema,
} from "@/application/dtos/tweets/service/tweets.dto.schema";
import { TweetResponsesSchema } from "../tweet.dto.schema";

export type CreateTweetServiceDto = z.infer<typeof createTweetServiceSchema>;

export type CreateReTweetServiceDto = z.infer<
  typeof createReTweetServiceSchema
>;

export type CreateReplyOrQuoteServiceDTO = z.infer<
  typeof CreateReplyOrQuoteServiceSchema
>;

export type TimelineServiceDTO = z.infer<typeof TimelineServiceSchema>;

export type SearchServiceDTO = z.infer<typeof SearchServiceSchema>;

export type TweetResponses = z.infer<typeof TweetResponsesSchema>;

export type CursorServiceDTO = z.infer<typeof CursorServiceSchema>;
