import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { listErrors } from "@/docs/errors";
import {
  HashTagResponseSchema,
  TweetResponsesSchema,
} from "@/application/dtos/tweets/tweet.dto.schema";
import { SearchQuery, TrendingTweetsParams } from "@/docs/utils/utils";

const errors = listErrors();

export const registerTrendsDocs = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: "get",
    path: "/api/hashtags/search",
    summary: "Search hashtags",
    tags: ["Hashtags"],
    request: {
      query: SearchQuery,
    },
    responses: {
      200: {
        description: "Matching hashtags found.",
        content: {
          "application/json": {
            schema: HashTagResponseSchema,
          },
        },
      },
      ...errors,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/trends",
    summary: "Get a list of available trends",
    description:
      "Returns the currently trending hashtags or topics in the last 24 hours.",
    tags: ["Trends"],
    responses: {
      200: {
        description: "List of trending topics returned successfully.",
        content: {
          "application/json": {
            schema: HashTagResponseSchema,
          },
        },
      },
      ...errors,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/trends/{name}/tweets",
    summary: "Get tweets for a specific trend",
    description:
      "Fetches all tweets related to the specified trending hashtag or keyword.",
    tags: ["Trends"],
    request: { params: TrendingTweetsParams },
    responses: {
      200: {
        description: "List of tweets associated with the trend.",
        content: {
          "application/json": {
            schema: z.array(TweetResponsesSchema),
          },
        },
      },
      ...errors,
    },
  });
};
