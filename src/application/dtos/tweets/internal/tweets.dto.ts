import z from "zod";
import {
  CreateReplyOrQuoteInternalSchema,
  createReTweetInternalSchema,
  createTweetInternalSchema,
} from "@/application/dtos/tweets/internal/tweets.dto.schema";

export type CreateTweetInternalDto = z.infer<typeof createTweetInternalSchema>;

export type CreateReTweetInternalDto = z.infer<
  typeof createReTweetInternalSchema
>;

export type CreateReplyOrQuoteInternalDTO = z.infer<
  typeof CreateReplyOrQuoteInternalSchema
>;
