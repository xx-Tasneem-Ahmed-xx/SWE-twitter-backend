import z from "zod";
export const CategoryQuery = z.object({
  category: z
    .enum(["sports", "news", "entertainment"])
    .describe("Category of tweets or trends to fetch"),
  limit: z.number().min(1).max(50).default(20).optional(),
  offset: z.number().default(0).optional(),
});

export const CursorPaginationQuery = z.object({
  limit: z.number().min(1).max(50).default(20),
  cursor: z
    .string()
    .optional()
    .describe("The cursor for pagination (createdAt of last tweet)"),
});

export const PaginationQuery = z.object({
  limit: z.number().min(1).max(50).default(20).optional(),
  offset: z.number().default(0).optional(),
});

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

export const SearchQuery = z.object({
  q: z.string().describe("Search keyword"),
  limit: z.number().min(1).max(100).default(20).describe("Result limit"),
  offset: z.number().default(0),
});
