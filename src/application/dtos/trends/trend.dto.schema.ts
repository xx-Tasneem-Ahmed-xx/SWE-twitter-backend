import z from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

// Query parameters schema
export const TrendQuerySchema = z
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
  .openapi("TrendQuery");

// Individual trend item schema (for internal use only, not registered in OpenAPI)
export const TrendItemSchema = z.object({
  hashtag: z.string(),
  tweetCount: z.number().int(),
  rank: z.number().int(),
});

// Trends list response schema - fully documented with inline structure
export const TrendsResponseSchema = z
  .object({
    trends: z
      .array(
        z.object({
          hashtag: z.string().openapi({
            description: "The hashtag text without # symbol",
            example: "typescript",
          }),
          tweetCount: z.number().int().openapi({
            description:
              "Number of tweets with this hashtag in the last 24 hours",
            example: 1234,
          }),
          rank: z.number().int().openapi({
            description: "Position in trending list (1-30)",
            example: 1,
          }),
        })
      )
      .openapi({
        description:
          "Array of trending hashtags, sorted by popularity (rank 1-30)",
        example: [
          { hashtag: "typescript", tweetCount: 1234, rank: 1 },
          { hashtag: "javascript", tweetCount: 987, rank: 2 },
          { hashtag: "nodejs", tweetCount: 654, rank: 3 },
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

// Trend tweets response schema
export const TrendTweetsResponseSchema = z
  .object({
    tweets: z.array(z.any()).describe("List of tweets with this hashtag"), // TODO: Replace with actual Tweet schema
    nextCursor: z
      .string()
      .nullable()
      .describe("Cursor for next page of results"),
    hasMore: z.boolean().describe("Whether there are more results"),
  })
  .openapi("TrendTweetsResponse");
