import z from "zod";
import {
  CreateRetweetDTOSchema,
  CreateTweetDTOSchema,
} from "@/application/dtos/tweets/tweet.dto.schema";

export const createTweetServiceSchema = CreateTweetDTOSchema.extend({
  userId: z.uuid(),
});

export const createReTweetServiceSchema = CreateRetweetDTOSchema.extend({
  userId: z.uuid(),
  parentId: z.uuid(),
});

export const CreateReplyOrQuoteServiceSchema = CreateTweetDTOSchema.extend({
  userId: z.uuid(),
  parentId: z.uuid(),
});
