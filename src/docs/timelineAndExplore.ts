import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import z from "zod";
import { listErrors } from "@/docs/errors";
import { CursorDTOSchema, timelineResponeSchema } from "@/application/dtos/tweets/tweet.dto.schema";

const errors = listErrors();

const CategoryParams = z.object({
  category: z
    .enum(["sports", "news", "entertainment"])
    .describe("Tweet or Trend category"),
});

export const registerTimelineAndExploreDocs = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: "get",
    path: "/api/explore/${category}",
    summary: "Get tweets or trends by category",
    description:
      "Fetch public tweets or trending content filtered by category (sports, news, or entertainment).",
    tags: ["Timeline"],
    request: { params: CategoryParams, query: CursorDTOSchema },
    responses: {
      200: {
        description: "Successfully retrieved tweets for the category",
        content: {
          "application/json": {
            schema: z.object({
              category: z.string(),
              tweets: z.array(z.array(timelineResponeSchema)),
            }),
          },
        },
      },
      ...errors,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/home/for-you",
    summary: "Get personalized recommended tweets",
    description:
      "Fetch tweets recommended to the user based on interests, engagement history, and trending content. Requires authentication.",
    tags: ["Timeline"],
    security: [{ bearerAuth: [] }],
    request: { query: CursorDTOSchema },
    responses: {
      200: {
        description: "Personalized recommended tweets retrieved successfully",
        content: {
          "application/json": {
            schema: z.object({
              user: z.string().describe("Authenticated user's username"),
              recommendations: z.array(timelineResponeSchema),
            }),
          },
        },
      },
      ...errors,
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/home/timeline",
    summary: "Get timeline tweets",
    description: "Fetches tweets from users the current user follows.",
    tags: ["Timeline"],
    request: { query: CursorDTOSchema },
    responses: {
      200: {
        description: "Timeline tweets fetched successfully",
        content: {
          "application/json": {
            schema: z.object({
              data: z.array(timelineResponeSchema),
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
};
