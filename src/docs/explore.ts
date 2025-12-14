import {
  StringSchema,
  TweetResponsesSchema,
} from "@/application/dtos/tweets/tweet.dto.schema";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { listErrors } from "@/docs/errors";
import {
  CategoriesResponseSchema,
  PreferredCategoriesSchema,
} from "@/application/dtos/explore/explore.dto.schema";

const errors = listErrors();

export const registerExploreDocs = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: "get",
    path: "/api/explore/categories",
    summary: "Get categories",
    description:
      "Retrieve a paginated list of categories available in Explore. Supports cursor-based pagination.",
    tags: ["Explore"],
    request: {
      query: z.object({ cursor: z.string() }),
    },
    responses: {
      200: {
        description: "Categories retrieved successfully",
        content: {
          "application/json": {
            schema: CategoriesResponseSchema,
          },
        },
      },
      ...errors,
    },
  });

  registry.registerPath({
    method: "post",
    path: "/api/explore/preferred-categories",
    summary: "Save user preferred categories",
    description:
      "Save the categories a user prefers. These preferences are used to personalize Explore feed.",
    tags: ["Explore"],
    request: {
      body: {
        required: true,
        content: {
          "application/json": {
            schema: PreferredCategoriesSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Preferred categories saved successfully",
        content: {
          "application/json": {
            schema: z.string().describe("Confirmation message"),
          },
        },
      },
      ...errors,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/explore",
    summary: "Get explore feed",
    description:
      "Retrieve a ranked feed of tweets for the Explore section. Supports filtering by category, pagination with cursor, and limiting results.",
    tags: ["Explore"],
    request: {
      query: z.object({
        category: StringSchema.optional().describe(
          "Category ID to filter tweets"
        ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(20)
          .describe("Number of tweets to return"),
        cursor: z.string().optional().describe("Pagination cursor"),
      }),
    },
    responses: {
      200: {
        description: "Explore feed retrieved successfully",
        content: {
          "application/json": {
            schema: TweetResponsesSchema,
          },
        },
      },
      ...errors,
    },
  });
};
