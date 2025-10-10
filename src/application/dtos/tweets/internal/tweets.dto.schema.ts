import z from "zod";
import {
  CreateRetweetDTOSchema,
  CreateTweetDTOSchema,
} from "@/application/dtos/tweets/tweet.dto.schema";

export const createTweetInternalSchema = CreateTweetDTOSchema.extend({
  userId: z.uuid(),
});

export const createReTweetInternalSchema = CreateRetweetDTOSchema.extend({
  userId: z.uuid(),
  parentId: z.uuid(),
});

export const CreateReplyOrQuoteInternalSchema = CreateTweetDTOSchema.extend({
  userId: z.uuid(),
  parentId: z.uuid(),
});
