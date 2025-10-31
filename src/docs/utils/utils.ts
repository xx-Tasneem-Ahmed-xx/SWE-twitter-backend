import z from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { CursorDTOSchema } from "@/application/dtos/tweets/tweet.dto.schema";

extendZodWithOpenApi(z);

export const CategoryQuery = z
  .object({
    category: z
      .enum(["sports", "news", "entertainment"])
      .describe("Category of tweets or trends to fetch"),
  })
  .extend(CursorDTOSchema.shape);

export const TweetIdParams = z.object({
  id: z.uuid().describe("Tweet ID"),
});

export const UsernameParams = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/)
    .describe("Username"),
});

export const TrendingTweetsParams = z.object({
  name: z.string().describe("Trend Name"),
});

export const SearchQuery = z
  .object({
    q: z.string().describe("Search keyword"),
  })
  .extend(CursorDTOSchema.shape);
