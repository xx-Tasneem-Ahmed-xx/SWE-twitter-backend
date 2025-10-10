import z from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

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
        })
      )
      .describe("List of followers or followings"),
  })
  .openapi("FollowsListResponse");
