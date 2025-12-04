import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  TrendsQuerySchema,
  HashtagTweetsQuerySchema,
  TrendsResponseSchema,
  HashtagTweetsResponseSchema,
  CategoriesQuerySchema,
  SingleCategoryResponseDataSchema,
  AllCategoriesResponseSchema,
} from "@/application/dtos/trends/trend.dto.schema";

export function registerHashtagAndTrendsDocs(registry: OpenAPIRegistry) {
  // Register schemas
  registry.register("TrendsQuery", TrendsQuerySchema);
  registry.register("HashtagTweetsQuery", HashtagTweetsQuerySchema);
  registry.register("TrendsResponse", TrendsResponseSchema);
  registry.register("HashtagTweetsResponse", HashtagTweetsResponseSchema);
  registry.register("CategoriesQuery", CategoriesQuerySchema);
  registry.register(
    "SingleCategoryResponseData",
    SingleCategoryResponseDataSchema
  );
  registry.register("AllCategoriesResponse", AllCategoriesResponseSchema);

  registry.registerPath({
    method: "get",
    path: "/api/hashtags/trends",
    summary: "Get trending hashtags",
    description:
      "Returns the top trending hashtags based on tweet count in the last 24 hours.\n\nIf the optional `q` query parameter is provided, the endpoint performs a case-insensitive prefix autocomplete search and returns matching hashtags ordered by recent popularity (last 24 hours). When `q` is absent, the endpoint returns the cached global trends (calculated in the background).",
    tags: ["Hashtags"],
    request: {
      query: TrendsQuerySchema,
    },
    responses: {
      200: {
        description: "List of trending hashtags",
        content: {
          "application/json": {
            schema: TrendsResponseSchema,
          },
        },
      },
      400: {
        description: "Invalid category parameter",
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/hashtags/{id}/tweets",
    summary: "Get tweets for a hashtag",
    description:
      "Returns tweets that contain the specified hashtag (works for any hashtag, trending or not)",
    tags: ["Hashtags"],
    request: {
      params: z.object({
        id: z
          .string()
          .describe(
            "The encoded hashtag ID (get this from the trends list endpoint)"
          ),
      }),
      query: HashtagTweetsQuerySchema,
    },
    responses: {
      200: {
        description: "List of tweets with this hashtag",
        content: {
          "application/json": {
            schema: HashtagTweetsResponseSchema,
          },
        },
      },
      404: {
        description: "Hashtag not found",
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/hashtags/categories",
    summary: "Get trending data by category",
    description:
      "Returns trending hashtags and viral tweets.\n\n" +
      "**With `category` parameter:** Returns trends and viral tweets for that specific category (global, news, sports, or entertainment).\n\n" +
      "**Without `category` parameter:** Returns trends and viral tweets for ALL categories.\n\n" +
      "Data is cached and updated every constant interval by a background worker.",
    tags: ["Hashtags"],
    request: {
      query: CategoriesQuerySchema,
    },
    responses: {
      200: {
        description: "Trending data - either single category or all categories",
        content: {
          "application/json": {
            schema: z.union([
              SingleCategoryResponseDataSchema,
              AllCategoriesResponseSchema,
            ]),
          },
        },
      },
      400: {
        description: "Invalid category parameter",
        content: {
          "application/json": {
            schema: z.object({
              error: z.string(),
              message: z.string(),
            }),
          },
        },
      },
    },
  });
}
