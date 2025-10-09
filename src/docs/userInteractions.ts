import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import z from "zod";

const UsernameParams = z.object({
  username: z.string().describe("Username of the user to interact with"),
});

const UserIdBody = z.object({
  id: z.string().uuid().describe("ID of the current user"),
});

export const registerUserInteractionsDocs = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: "post",
    path: "/api/follow-requests/{username}",
    summary: "/Follow a user or send a follow request",
    tags: ["User Interactions"],
    request: { params: UsernameParams },
    responses: {
      201: { description: "Follow request sent or user followed successfully" },
      400: { description: "Can't follow yourself or already following user" },
      403: { description: "Can't follow blocked users /users who blocked you" },
      404: { description: "User not found" },
      500: { description: "Internal server error" },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/follow-requests/{username}",
    summary: "Unfollow a user or cancel a pending follow request",
    tags: ["User Interactions"],
    request: { params: UsernameParams },
    responses: {
      200: { description: "Unfollowed user or cancelled follow request" },
      400: { description: "You are not following this user" },
      404: { description: "User not found" },
      500: { description: "Internal server error" },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/follow-responses/{username}",
    summary: "Accept a follow request",
    tags: ["User Interactions"],
    request: { params: UsernameParams },
    responses: {
      200: { description: "Follow request accepted" },
      404: { description: "No follow request found" },
      409: { description: "Follow request already accepted" },
      500: { description: "Internal server error" },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/follow-responses/{username}",
    summary: "Decline a follow request or remove a follower",
    tags: ["User Interactions"],
    request: { params: UsernameParams },
    responses: {
      200: { description: "Follow request declined" },
      404: { description: "No follow request found" },
      409: { description: "Follow request already accepted" },
      500: { description: "Internal server error" },
    },
  });
};
