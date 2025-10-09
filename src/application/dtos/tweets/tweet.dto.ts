import z from "zod";
import {
  CreateTweetDTOSchema,
  CreateReplyOrQuoteDTOSchema,
  CreateRetweetDTOSchema,
} from "@/application/dtos/tweets/tweet.dto.schema";

export type CreateTweetDTO = z.infer<typeof CreateTweetDTOSchema>;

export type CreateReplyOrQuoteDTO = z.infer<typeof CreateReplyOrQuoteDTOSchema>;

export type CreateRetweetDTO = z.infer<typeof CreateRetweetDTOSchema>;
