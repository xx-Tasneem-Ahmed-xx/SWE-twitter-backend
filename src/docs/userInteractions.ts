import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import {
  UserInteractionParamsSchema,
  FollowsListResponseSchema,
} from "@/application/dtos/userInteractions/userInteraction.dto.schema";

export const registerUserInteractionsDocs = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: "post",
    path: "/api/followers/{username}",
    summary: "/Follow a user or send a follow request",
    tags: ["User Interactions"],
    request: { params: UserInteractionParamsSchema },
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
    path: "/api/followers/{username}",
    summary: "Unfollow a user or cancel a pending follow request",
    tags: ["User Interactions"],
    request: { params: UserInteractionParamsSchema },
    responses: {
      200: { description: "Unfollowed user or cancelled follow request" },
      400: { description: "You are not following this user" },
      404: { description: "User not found" },
      500: { description: "Internal server error" },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/followings/{username}",
    summary: "Accept a follow request",
    tags: ["User Interactions"],
    request: { params: UserInteractionParamsSchema },
    responses: {
      200: { description: "Follow request accepted" },
      404: { description: "No follow request found" },
      409: { description: "Follow request already accepted" },
      500: { description: "Internal server error" },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/followings/{username}",
    summary: "Decline a follow request or remove a follower",
    tags: ["User Interactions"],
    request: { params: UserInteractionParamsSchema },
    responses: {
      200: { description: "Follow request declined" },
      404: { description: "No follow request found" },
      409: { description: "Follow request already accepted" },
      500: { description: "Internal server error" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/followers/{username}",
    summary: "Get a list of followers for a user by their username",
    tags: ["User Interactions"],
    request: { params: UserInteractionParamsSchema },
    responses: {
      200: {
        description: "List of followers retrieved successfully",
        content: {
          "application/json": {
            schema: FollowsListResponseSchema,
          },
        },
      },
      403: { description: "Can't view followers of blocked / blocking users" },
      404: { description: "User not found" },
      500: { description: "Internal server error" },
    },
  });

  registry.registerPath({
    method: "get",
    path: "/api/followings/{username}",
    summary: "Get a list of followings for a user by their username",
    tags: ["User Interactions"],
    request: { params: UserInteractionParamsSchema },
    responses: {
      200: {
        description: "List of followings retrieved successfully",
        content: {
          "application/json": {
            schema: FollowsListResponseSchema,
          },
        },
      },
      403: { description: "Can't view followings of blocked / blocking users" },
      404: { description: "User not found" },
      500: { description: "Internal server error" },
    },
  });
};
