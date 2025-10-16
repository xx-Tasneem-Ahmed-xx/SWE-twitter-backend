import {
  CreateTweetDTOSchema,
  HashTagResponseSchema,
  timelineResponeSchema,
  TweetResponsesSchema,
  TweetSummaryResponse,
  UsersResponseSchema,
} from "@/application/dtos/tweets/tweet.dto.schema";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { listErrors } from "@/docs/errors";

const errors = listErrors();

const TweetIdParams = z.object({
  id: z.uuid().describe("Tweet ID"),
});

const UsernameParams = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/)
    .describe("Username"),
});

const TrendingTweetsParams = z.object({
  name: z.string().describe("Trend Name"),
});

const SearchQuery = z.object({
  q: z.string().describe("Search keyword"),
  limit: z.number().min(1).max(100).default(20).describe("Result limit"),
  offset: z.number().default(0),
});

const CursorPaginationQuery = z.object({
  limit: z.number().min(1).max(50).default(20),
  cursor: z
    .string()
    .optional()
    .describe("The cursor for pagination (createdAt of last tweet)"),
});

function registerSubList(
  registry: OpenAPIRegistry,
  name: string,
  description: string,
  schema: z.ZodTypeAny,
  tag: string
) {
  registry.registerPath({
    method: "get",
    path: `/api/tweets/{id}/${name}`,
    summary: `Get tweet ${name}`,
    tags: [tag],
    request: { params: TweetIdParams },
    responses: {
      200: {
        description,
        content: {
          "application/json": {
            schema: schema,
          },
        },
      },
      ...errors,
    },
  });
}

export const registerTweetDocs = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: "post",
    path: "/api/tweets",
    summary: "Create a tweet",
    tags: ["Tweets"],
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: CreateTweetDTOSchema,
          },
        },
      },
    },
    responses: {
      201: { description: "Tweet created successfully" },
      ...errors,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/tweets/{id}/retweets",
    summary: "Retweet a tweet",
    tags: ["Tweets"],
    request: { params: TweetIdParams },
    responses: { 201: { description: "Tweet retweeted successfully" } },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/tweets/{id}/retweets",
    summary: "Delete a retweet",
    tags: ["Tweets"],
    request: { params: TweetIdParams },
    responses: { 200: { description: "Retweet deleted successfully" } },
  });

  registry.registerPath({
    method: "post",
    path: "/api/tweets/{id}/replies",
    summary: "Reply to a tweet",
    tags: ["Tweets"],
    request: {
      params: TweetIdParams,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: CreateTweetDTOSchema,
          },
        },
      },
    },
    responses: {
      201: { description: "Reply created successfully" },
      ...errors,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/tweets/{id}/quotes",
    summary: "Quote a tweet",
    tags: ["Tweets"],
    request: {
      params: TweetIdParams,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: CreateTweetDTOSchema,
          },
        },
      },
    },
    responses: {
      201: { description: "Quote created successfully" },
      ...errors,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/tweets/{id}/quotes",
    summary: "Get tweet quotes",
    tags: ["Tweets"],
    request: {
      params: TweetIdParams,
    },
    responses: {
      200: {
        description: "List of quoters",
        content: {
          "application/json": {
            schema: z.array(TweetResponsesSchema),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/tweets/{id}",
    summary: "Get tweet details",
    tags: ["Tweets"],
    request: { params: TweetIdParams },
    responses: {
      200: {
        description: "Tweet details fetched successfully",
        content: {
          "application/json": {
            schema: TweetResponsesSchema,
          },
        },
      },
      ...errors,
    },
  });

  registry.registerPath({
    method: "put",
    path: "/api/tweets/{id}",
    summary: "Update a tweet",
    description: "Updates a tweet if the user is its author.",
    tags: ["Tweets"],
    request: {
      params: TweetIdParams,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: TweetResponsesSchema,
          },
        },
      },
    },
    responses: {
      200: { description: "Tweet updated successfully" },
      ...errors,
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/tweets/{id}",
    summary: "Delete a tweet",
    description: "Deletes a tweet if the user is its author.",
    tags: ["Tweets"],
    request: { params: TweetIdParams },
    responses: {
      204: { description: "Tweet deleted successfully" },
      ...errors,
    },
  });

  registerSubList(
    registry,
    "retweets",
    "Users who retweeted the tweet",
    UsersResponseSchema,
    "Tweets"
  );
  registerSubList(
    registry,
    "replies",
    "Replies under the tweet",
    z.array(TweetResponsesSchema),
    "Tweets"
  );

  registry.registerPath({
    method: "get",
    path: "/api/tweets/timeline",
    summary: "Get timeline tweets",
    description: "Fetches tweets from users the current user follows.",
    tags: ["Timeline and Feed"],
    request: { query: CursorPaginationQuery },
    responses: {
      200: {
        description: "Timeline tweets fetched successfully",
        content: {
          "application/json": {
            schema: z.object({
              data: z.array(TweetResponsesSchema),
              nextCursor: z
                .string()
                .nullable()
                .describe("Cursor for next page"),
            }),
          },
        },
      },
      ...errors,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/tweets/search",
    summary: "Search for tweets",
    description: "Search tweets by content, hashtag, or users.",
    tags: ["Timeline and Feed"],
    request: {
      query: SearchQuery,
    },
    responses: {
      200: {
        description: "List of matching tweets",
        content: {
          "application/json": {
            schema: TweetResponsesSchema,
          },
        },
        ...errors,
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/tweets/user/{username}",
    summary: "Get user's tweets",
    description: "Returns all tweets authored by the specified user.",
    tags: ["Timeline and Feed"],
    request: { params: UsernameParams },
    responses: {
      200: {
        description: "Tweets retrieved successfully",
        content: {
          "application/json": {
            schema: z.array(TweetResponsesSchema),
          },
        },
      },
      ...errors,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/tweets/user/{username}/mentioned",
    summary: "Get tweets that the user is mentioned in",
    tags: ["Timeline and Feed"],
    request: { params: UsernameParams },
    responses: {
      200: {
        description: "Mentioned tweets fetched successfully",
        content: {
          "application/json": {
            schema: z.array(TweetResponsesSchema),
          },
        },
      },
      ...errors,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/tweets/{id}/likes",
    summary: "Like a tweet",
    description: "Likes a tweet on behalf of the current user.",
    tags: ["Tweets Interactions"],
    request: { params: TweetIdParams },
    responses: { 200: { description: "Tweet liked successfully" }, ...errors },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/tweets/{id}/likes",
    summary: "Unlike a tweet",
    description: "Removes a like from the tweet.",
    tags: ["Tweets Interactions"],
    request: { params: TweetIdParams },
    responses: {
      200: { description: "Tweet unliked successfully" },
      ...errors,
    },
  });

  registerSubList(
    registry,
    "likes",
    "Users who liked the tweet",
    UsersResponseSchema,
    "Tweets Interactions"
  );

  registry.registerPath({
    method: "get",
    path: "/api/tweets/likedtweets",
    summary: "Get tweets liked by the user",
    tags: ["Tweets Interactions"],
    responses: {
      200: {
        description: "Liked tweets fetched successfully",
        content: {
          "application/json": {
            schema: z.array(TweetResponsesSchema),
          },
        },
      },
      ...errors,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/tweets/{id}/bookmark",
    summary: "Bookmark a tweet",
    description: "Adds a tweet to the user’s bookmarks.",
    tags: ["Tweets Interactions"],
    request: { params: TweetIdParams },
    responses: {
      200: { description: "Tweet bookmarked successfully" },
      ...errors,
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/tweets/{id}/bookmark",
    summary: "Remove bookmark",
    description: "Removes the tweet from user’s bookmarks.",
    tags: ["Tweets Interactions"],
    request: { params: TweetIdParams },
    responses: {
      200: { description: "Bookmark removed successfully" },
      ...errors,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/tweets/{id}/summary",
    summary: "Get tweet summary",
    description: "Returns an AI-generated summary of a tweet.",
    tags: ["Tweets Interactions"],
    request: { params: TweetIdParams },
    responses: {
      200: {
        description: "Summary retrieved successfully",
        content: {
          "application/json": {
            schema: TweetSummaryResponse,
          },
        },
      },
      ...errors,
    },
  });

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
