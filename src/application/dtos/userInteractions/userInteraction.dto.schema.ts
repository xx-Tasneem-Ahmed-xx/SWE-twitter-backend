import z from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const UserInteractionQuerySchema = z
  .object({
    // cursor may be omitted from the query string; make it optional and default to null
    cursor: z
      .string()
      .nullable()
      .optional()
      .default(null)
      .describe("Opaque cursor for pagination."),
    limit: z
      .coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(30)
      .describe("Number of results per page (default: 30)"),
  })
  .openapi("UserInteractionQuery");

export const UserInteractionParamsSchema = z
  .object({
    username: z
      .string()
      .min(1, { message: "Username must not be empty" })
      .describe("Username of the user to interact with"),
  })
  .openapi("UserInteractionParams");

export const FollowsListResponseSchema = z
  .object({
    users: z
      .array(
        z.object({
          username: z.string().describe("Username"),
          name: z.string().describe("Display name"),
          photo: z.string().url().nullable().describe("Avatar URL"),
          bio: z.string().nullable().describe("User bio"),
          verified: z.boolean().describe("Is the user verified"),
          isFollowing: z
            .boolean()
            .describe("Is the current user following this user"),
          isFollower: z
            .boolean()
            .describe("Is this user following the current user"),
          youRequested: z
            .boolean()
            .describe(
              "Has the current user sent a follow request to this user"
            ),
          followStatus: z
            .enum(["NONE", "PENDING", "ACCEPTED"])
            .describe(
              "Follow status between result user and target (param) user"
            ),
        })
      )
      .describe("List of followers, followings, blocked or muted users"),
    nextCursor: z
      .string()
      .nullable()
      .describe(
        "Opaque cursor for pagination; pass as 'cursor' in the next request. Null if no more data."
      ),
    hasMore: z
      .boolean()
      .describe(
        "True if more data is available; false if this is the last page."
      ),
  })
  .openapi("UserInteractionsListResponse");
