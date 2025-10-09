import {
  CreateReplyOrQuoteDTOSchema,
  CreateTweetDTOSchema,
  HashTagResponseSchema,
  TweetResponsesSchema,
  TweetSummaryResponse,
  UsersResponseSchema,
} from "../application/dtos/tweets/tweet.dto.schema";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import z from "zod";

const TweetIdParams = z.object({
  id: z.uuid().describe("Tweet ID"),
});

const UserIdParams = z.object({
  id: z.uuid().describe("User ID"),
});

const TrendingTweetsParams = z.object({
  name: z.string().describe("Trend Name"),
});

const SearchQuery = z.object({
  q: z.string().describe("Search keyword"),
  limit: z.number().default(20).describe("Result limit"),
});

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
      400: { description: "Failed to create tweet" },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/tweets/{id}/retweet",
    summary: "Retweet a tweet",
    tags: ["Tweets"],
    request: { params: TweetIdParams },
    responses: { 201: { description: "Tweet retweeted successfully" } },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/tweets/{id}/retweet",
    summary: "Delete a retweet",
    tags: ["Tweets"],
    request: { params: TweetIdParams },
    responses: { 200: { description: "Retweet deleted successfully" } },
  });

  registry.registerPath({
    method: "post",
    path: "/api/tweets/{id}/reply",
    summary: "Reply to a tweet",
    tags: ["Tweets"],
    request: {
      params: TweetIdParams,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: CreateReplyOrQuoteDTOSchema,
          },
        },
      },
    },
    responses: {
      201: { description: "Reply created successfully" },
      403: { description: "Not allowed to reply" },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/tweets/{id}/quote",
    summary: "Quote a tweet",
    tags: ["Tweets"],
    request: {
      params: TweetIdParams,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: CreateReplyOrQuoteDTOSchema,
          },
        },
      },
    },
    responses: {
      201: { description: "Quote created successfully" },
      403: { description: "Not allowed to quote" },
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
      404: { description: "Tweet not found" },
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
      403: { description: "Not authorized to update this tweet" },
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
      403: { description: "Not authorized" },
      404: { description: "Tweet not found" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/tweets/{id}/likers",
    summary: "Get users who liked a tweet",
    tags: ["Tweets"],
    request: { params: TweetIdParams },
    responses: {
      200: {
        description: "Tweet likers fetched successfully",
        content: {
          "application/json": {
            schema: UsersResponseSchema,
          },
        },
      },
      404: { description: "Failed to fetch likers" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/tweets/{id}/retweeters",
    summary: "Get users who retweeted a tweet",
    tags: ["Tweets"],
    request: { params: TweetIdParams },
    responses: {
      200: {
        description: "Tweet retweeters fetched successfully",
        content: {
          "application/json": {
            schema: UsersResponseSchema,
          },
        },
      },
      404: { description: "Failed to fetch retweeters" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/tweets/search",
    summary: "Search for tweets",
    description: "Search tweets by content, hashtag, or users.",
    tags: ["Tweets"],
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
      },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/tweets/user/{userId}",
    summary: "Get tweets by user",
    description: "Returns all tweets authored by the specified user.",
    tags: ["Timeline and Feed"],
    request: { params: UserIdParams },
    responses: {
      200: {
        description: "Tweets retrieved successfully",
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
    path: "/api/tweets/user/{userId}/likedtweets",
    summary: "Get tweets liked by the user",
    tags: ["Timeline and Feed"],
    request: { params: UserIdParams },
    responses: {
      200: {
        description: "Liked tweets fetched successfully",
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
    path: "/api/tweets/user/{userId}/mentioned",
    summary: "Get tweets that the user is mentioned in",
    tags: ["Timeline and Feed"],
    request: { params: UserIdParams },
    responses: {
      200: {
        description: "Mentioned tweets fetched successfully",
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
    path: "/api/tweets/timeline",
    summary: "Get timeline tweets",
    description: "Fetches tweets from users the current user follows.",
    tags: ["Timeline and Feed"],
    responses: {
      200: {
        description: "Timeline tweets fetched successfully",
        content: {
          "application/json": {
            schema: z.array(TweetResponsesSchema),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/tweets/{id}/like",
    summary: "Like a tweet",
    description: "Likes a tweet on behalf of the current user.",
    tags: ["Tweets Interactions"],
    request: { params: TweetIdParams },
    responses: { 200: { description: "Tweet liked successfully" } },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/tweets/{id}/like",
    summary: "Unlike a tweet",
    description: "Removes a like from the tweet.",
    tags: ["Tweets Interactions"],
    request: { params: TweetIdParams },
    responses: { 200: { description: "Tweet unliked successfully" } },
  });

  registry.registerPath({
    method: "get",
    path: "/api/tweets/{id}/replies",
    summary: "Get all replies",
    description: "Fetches all replies under a specific tweet.",
    tags: ["Tweets"],
    request: { params: TweetIdParams },
    responses: {
      200: {
        description: "Replies fetched successfully",
        content: {
          "application/json": {
            schema: z.array(TweetResponsesSchema),
          },
        },
      },
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/tweets/{id}/bookmark",
    summary: "Bookmark a tweet",
    description: "Adds a tweet to the user’s bookmarks.",
    tags: ["Tweets Interactions"],
    request: { params: TweetIdParams },
    responses: { 200: { description: "Tweet bookmarked successfully" } },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/tweets/{id}/bookmark",
    summary: "Remove bookmark",
    description: "Removes the tweet from user’s bookmarks.",
    tags: ["Tweets Interactions"],
    request: { params: TweetIdParams },
    responses: { 200: { description: "Bookmark removed successfully" } },
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
    },
  });

  registry.registerPath({
    method: "get",
    path: "/trends",
    summary: "Get a list of available trends",
    description:
      "Returns the currently trending hashtags or topics globally or by location.",
    tags: ["Trends"],
    //TODO: confirm from TA trend entity
    // request: {
    //   query: {
    //     location: {
    //       type: "string",
    //       required: false,
    //       description: "Optional location (e.g., 'egypt', 'us').",
    //     },
    //   },
    // },
    responses: {
      200: {
        description: "List of trending topics returned successfully.",
        content: {
          "application/json": {
            schema: HashTagResponseSchema,
          },
        },
      },
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
      404: { description: "Trend not found." },
    },
  });
};
