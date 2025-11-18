import z from "zod";
import {
  TweetCursorServiceSchema,
  CreateReplyOrQuoteServiceSchema,
  createReTweetServiceSchema,
  createTweetServiceSchema,
  SearchServiceSchema,
  TimelineServiceSchema,
  InteractionsCursorServiceSchema,
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

export type TweetCursorServiceDTO = z.infer<typeof TweetCursorServiceSchema>;

export type InteractionsCursorServiceDTO = z.infer<
  typeof InteractionsCursorServiceSchema
>;
