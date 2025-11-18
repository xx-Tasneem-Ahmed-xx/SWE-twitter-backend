import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  TrendsQuerySchema,
  HashtagTweetsQuerySchema,
  TrendsResponseSchema,
  HashtagTweetsResponseSchema,
} from "@/application/dtos/trends/trend.dto.schema";

export function registerHashtagAndTrendsDocs(registry: OpenAPIRegistry) {
  // Register schemas
  registry.register("TrendsQuery", TrendsQuerySchema);
  registry.register("HashtagTweetsQuery", HashtagTweetsQuerySchema);
  registry.register("TrendsResponse", TrendsResponseSchema);
  registry.register("HashtagTweetsResponse", HashtagTweetsResponseSchema);

  registry.registerPath({
    method: "get",
    path: "/api/hashtags/trends",
    summary: "Get trending hashtags",
    description:
      "Returns the top trending hashtags based on tweet count in the last 24 hours",
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
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/hashtags/{id}/tweets",
    summary: "Get tweets for a hashtag",
    description: "Returns tweets that contain the specified hashtag (works for any hashtag, trending or not)",
    tags: ["Hashtags"],
    request: {
      params: z.object({
        id: z.string().describe("The encoded hashtag ID (get this from the trends list endpoint)"),
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
}
