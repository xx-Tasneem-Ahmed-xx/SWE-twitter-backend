import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  TrendQuerySchema,
  TrendsResponseSchema,
  TrendTweetsResponseSchema,
} from "@/application/dtos/trends/trend.dto.schema";

const TrendIdParamSchema = z.object({
  id: z.string().describe("The hashtag (without # symbol)"),
});

export function registerHashtagAndTrendsDocs(registry: OpenAPIRegistry) {
  // Register schemas
  registry.register("TrendQuery", TrendQuerySchema);
  registry.register("TrendsResponse", TrendsResponseSchema);
  registry.register("TrendTweetsResponse", TrendTweetsResponseSchema);

  // GET /api/trends - Get trending hashtags
  registry.registerPath({
    method: "get",
    path: "/api/trends",
    summary: "Get trending hashtags",
    description:
      "Returns the top trending hashtags based on tweet count in the last 24 hours",
    tags: ["Trends"],
    request: {
      query: TrendQuerySchema,
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

  // GET /api/trends/:id/tweets - Get tweets for a trending hashtag
  registry.registerPath({
    method: "get",
    path: "/api/trends/{id}/tweets",
    summary: "Get tweets for a trending hashtag",
    description: "Returns tweets that contain the specified trending hashtag",
    tags: ["Trends"],
    request: {
      params: TrendIdParamSchema,
      query: TrendQuerySchema,
    },
    responses: {
      200: {
        description: "List of tweets with this hashtag",
        content: {
          "application/json": {
            schema: TrendTweetsResponseSchema,
          },
        },
      },
      404: {
        description: "Hashtag not found",
      },
    },
  });
}
