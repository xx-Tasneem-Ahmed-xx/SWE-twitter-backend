import z from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { TweetResponsesSchema } from "@/application/dtos/tweets/tweet.dto.schema";
import { T } from "@faker-js/faker/dist/airline-DF6RqYmq";

extendZodWithOpenApi(z);

// Query parameters schema for getting trends list (no cursor needed)
export const TrendsQuerySchema = z
  .object({
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(30)
      .default(30)
      .optional()
      .describe("Number of trends to return (max: 30)"),
    q: z
      .string()
      .optional()
      .describe(
        "Optional prefix query string for autocompletion/search (case-insensitive). When provided, endpoint returns matching hashtags ordered by recent popularity."
      ),
  })
  .openapi("TrendsQuery");

// Query parameters schema for hashtag tweets (with cursor for pagination)
export const HashtagTweetsQuerySchema = z
  .object({
    cursor: z
      .string()
      .nullable()
      .optional()
      .default(null)
      .describe("Opaque cursor for pagination."),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(50)
      .default(30)
      .describe("Number of results per page (default: 30)"),
  })
  .openapi("HashtagTweetsQuery");

// Individual trend item schema (for internal use only, not registered in OpenAPI)
export const TrendItemSchema = z.object({
  id: z.string().describe("Encoded hashtag ID").openapi({
    example: "abc123def456.sig",
  }),
  hashtag: z
    .string()
    .describe("The hashtag text without the # symbol")
    .openapi({
      example: "typescript",
    }),
  tweetCount: z
    .number()
    .int()
    .describe("Number of tweets using this hashtag in the last 24 hours")
    .openapi({
      example: 1234,
    }),
  likesCount: z
    .number()
    .int()
    .optional()
    .describe("Total likes across all tweets with this hashtag")
    .openapi({
      example: 5678,
    }),
  score: z
    .number()
    .optional()
    .describe("Calculated trending score based on engagement and recency")
    .openapi({
      example: 42.5,
    }),
  rank: z
    .number()
    .int()
    .describe("Current ranking position (1 = most trending)")
    .openapi({
      example: 1,
    }),
});

// Trends list response schema - fully documented with inline structure
export const TrendsResponseSchema = z
  .object({
    trends: z.array(TrendItemSchema).openapi({
      description:
        "Array of trending hashtags, sorted by popularity (rank 1-30)",
      example: [
        {
          id: "abc123.sig",
          hashtag: "typescript",
          tweetCount: 1234,
          rank: 1,
        },
        { id: "def456.sig", hashtag: "javascript", tweetCount: 987, rank: 2 },
        { id: "ghi789.sig", hashtag: "nodejs", tweetCount: 654, rank: 3 },
      ],
    }),
    updatedAt: z.string().datetime().openapi({
      description:
        "ISO 8601 timestamp of when trends were last calculated (updated every 30 minutes)",
      example: "2024-11-18T10:30:00.000Z",
    }),
  })
  .openapi("TrendsResponse", {
    description: "List of trending hashtags from the last 24 hours",
  });

// Hashtag tweets response schema
export const HashtagTweetsResponseSchema = z
  .object({
    tweets: z.array(TweetResponsesSchema).openapi({
      description: "List of tweets containing this hashtag",
    }),
    nextCursor: z.string().nullable().openapi({
      description:
        "Encoded cursor for next page of results (null if no more pages)",
    }),
    hasMore: z.boolean().openapi({
      description: "Whether there are more tweets available for pagination",
    }),
  })
  .openapi("HashtagTweetsResponse", {
    description: "Paginated list of tweets for a hashtag",
  });

// Query parameters for explore endpoints
export const CategoriesQuerySchema = z
  .object({
    category: z
      .enum(["global", "news", "sports", "entertainment"])
      .optional()
      .describe(
        "Category to filter by. If not provided for /explore, returns all categories."
      ),
  })
  .openapi("ExploreQuery");

// Who to follow user schema
export const WhoToFollowUserSchema = z.object({
  id: z.string().describe("User ID").openapi({ example: "user123" }),
  name: z
    .string()
    .nullable()
    .describe("User's display name")
    .openapi({ example: "John Doe" }),
  username: z
    .string()
    .describe("User's @username")
    .openapi({ example: "johndoe" }),
  profileMedia: z
    .object({ id: z.string() })
    .nullable()
    .optional()
    .describe("User's profile picture")
    .openapi({
      example: { id: "media123" },
    }),
  protectedAccount: z
    .boolean()
    .describe("Whether the account is protected")
    .openapi({ example: false }),
  verified: z
    .boolean()
    .describe("Whether the account is verified")
    .openapi({ example: true }),
  bio: z
    .string()
    .nullable()
    .optional()
    .describe("User's bio")
    .openapi({ example: "Tech enthusiast and blogger." }),
  followersCount: z
    .number()
    .int()
    .describe("Number of followers")
    .openapi({ example: 12500 }),
  isFollowed: z
    .boolean()
    .describe("Whether the current user follows this account (false always)")
    .openapi({ example: false }),
});

// Category data response schema (single category)
export const SingleCategoryResponseDataSchema = z
  .object({
    category: z.enum(["global", "news", "sports", "entertainment"]).openapi({
      description: "The category name",
      example: "sports",
    }),
    trends: z.array(TrendItemSchema).openapi({
      description: "Array of trending hashtags for this category",
    }),
    viralTweets: z.array(TweetResponsesSchema).openapi({
      description: "Top 5 viral tweets from this category",
    }),
    updatedAt: z.string().datetime().openapi({
      description: "ISO 8601 timestamp of when data was last updated",
      example: "2024-12-04T10:30:00.000Z",
    }),
  })
  .openapi("CategoryData", {
    description: "Trending data for a specific category",
  });

// Response for all categories
export const AllCategoriesResponseSchema = z
  .object({
    categories: z.array(SingleCategoryResponseDataSchema).openapi({
      description: "Array of trending data for each category",
    }),
    whoToFollow: z.array(WhoToFollowUserSchema).openapi({
      description: "Top 5 users to follow (shared across all categories)",
    }),
  })
  .openapi("AllCategoriesResponse", {
    description:
      "Trending data for all categories with who to follow suggestions",
    example: {
      categories: [
        {
          category: "global",
          trends: [],
          viralTweets: [],
          updatedAt: "2024-12-04T10:30:00.000Z",
        },
        {
          category: "news",
          trends: [],
          viralTweets: [],
          updatedAt: "2024-12-04T10:30:00.000Z",
        },
        {
          category: "sports",
          trends: [],
          viralTweets: [],
          updatedAt: "2024-12-04T10:30:00.000Z",
        },
        {
          category: "entertainment",
          trends: [],
          viralTweets: [],
          updatedAt: "2024-12-04T10:30:00.000Z",
        },
      ],
      whoToFollow: [
        {
          id: "user123",
          name: "John Doe",
          username: "johndoe",
          profileMedia: { id: "media123" },
          protectedAccount: false,
          verified: true,
          followersCount: 12500,
          isFollowed: false,
        },
      ],
    },
  });
