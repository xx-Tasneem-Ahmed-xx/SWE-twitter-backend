import z from "zod";
import {
  CreateReplyOrQuoteServiceSchema,
  createReTweetServiceSchema,
  createTweetServiceSchema,
  TimelineServiceSchema,
} from "@/application/dtos/tweets/service/tweets.dto.schema";

export type CreateTweetServiceDto = z.infer<typeof createTweetServiceSchema>;

export type CreateReTweetServiceDto = z.infer<
  typeof createReTweetServiceSchema
>;

export type CreateReplyOrQuoteServiceDTO = z.infer<
  typeof CreateReplyOrQuoteServiceSchema
>;

export type TimelineServiceDTO = z.infer<typeof TimelineServiceSchema>;
