import {
  CreateTweetDTOSchema,
  CursorDTOSchema,
  SearchDTOSchema,
  StringSchema,
  TweetListResponseSchema,
  TweetResponsesSchema,
  TweetSummaryResponse,
  UsersResponseSchema,
} from "@/application/dtos/tweets/tweet.dto.schema";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { listErrors } from "@/docs/errors";
import { TweetIdParams, UsernameParams } from "@/docs/utils/utils";
import { TweetType } from "@prisma/client";
const errors = listErrors();

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
    request: { params: TweetIdParams, query: CursorDTOSchema },
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
      query: CursorDTOSchema,
    },
    responses: {
      200: {
        description: "List of quoters",
        content: {
          "application/json": {
            schema: TweetListResponseSchema,
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
    method: "patch",
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
            schema: z.object({
              content: StringSchema,
            }),
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
    TweetListResponseSchema,
    "Tweets"
  );

  registry.registerPath({
    method: "get",
    path: "/api/tweets/users/{username}/mentioned",
    summary: "Get tweets that the user is mentioned in",
    tags: ["Tweets Interactions"],
    request: {
      params: UsernameParams,
      query: CursorDTOSchema,
    },
    responses: {
      200: {
        description: "Mentioned tweets fetched successfully",
        content: {
          "application/json": {
            schema: TweetListResponseSchema,
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
            schema: TweetListResponseSchema,
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
    path: "/api/tweets/search",
    summary: "Search for tweets",
    description: "Search tweets by content, hashtag, or users.",
    tags: ["Tweets"],
    request: {
      query: SearchDTOSchema,
    },
    responses: {
      200: {
        description: "List of matching tweets",
        content: {
          "application/json": {
            schema: TweetListResponseSchema,
          },
        },
        ...errors,
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/tweets/users/{username}",
    summary: "Get user's tweets",
    description:
      "Returns all tweets or replies authored by the specified user.",
    tags: ["Tweets"],
    request: {
      params: UsernameParams,
      query: CursorDTOSchema.extend({
        tweetType: z.enum(TweetType),
      }),
    },
    responses: {
      200: {
        description: "Tweets retrieved successfully",
        content: {
          "application/json": {
            schema: TweetListResponseSchema,
          },
        },
      },
      ...errors,
    },
  });
};
