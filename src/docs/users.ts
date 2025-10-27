import {
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import path from "path";
import z from "zod";

extendZodWithOpenApi(z); 


const UsernameParams = z.object({
  username: z.string().describe("Unique username of the user"),
});

const UserIdParams = z.object({
  id: z.string().uuid().describe("Unique ID of the user"),
});

const MediaIdParams = z.object({
  mediaId: z
    .string()
    .uuid()
    .describe("Unique ID of the media to set as profile photo"),
});

const CoverIdParams = z.object({
  coverId: z
    .string()
    .uuid()
    .describe("Unique ID of the media to set as the banner (cover image)"),
});

const UpdateUserBody = z.object({
  bio: z.string().optional().describe("User biography text"),
  website: z.string().optional().describe("Personal website URL"),
  profilePhoto: z.string().optional().describe("Profile photo URL"),
  protectedAccount: z
    .boolean()
    .optional()
    .describe("Whether the account is protected"),
  address: z.string().optional().describe("User address"),
  cover: z.string().optional().describe("Cover image URL"),
  name: z.string().optional().describe("User's full name"),
});

const UserResponse = z.object({
  id: z.string().uuid(),
  username: z.string(),
  email: z.string(),
  bio: z.string().nullable(),
  website: z.string().nullable(),
  profilePhoto: z.string().nullable(),
  protectedAccount: z.boolean(),
  verified: z.boolean(),
  joinDate: z.string().describe("Date the user joined the platform"),
});

const SearchUserQuery = z.object({
  query: z
    .string()
    .min(1)
    .describe("Part of username or screen name to search for"),
});

const SearchUserResponse = z.object({
  id: z.string().uuid(),
  username: z.string(),
  name: z.string().nullable(),
  profilePhoto: z.string().nullable().optional(),
  verified: z.boolean(),
});

export const registerUserDocs = (registry: OpenAPIRegistry) => {
  registry.registerPath({
    method: "get",
    path: "/api/users/{username}",
    summary: "Get user profile by username",
    description:
      "Fetch the public profile of a specific user by their username.",
    tags: ["Users"],
    request: {
      params: UsernameParams,
    },
    responses: {
      200: {
        description: "User profile fetched successfully.",
        content: {
          "application/json": {
            schema: UserResponse,
          },
        },
      },
      404: { description: "User not found." },
    },
  });
registry.registerPath({
  method: "patch",
  path: "/api/users/{id}",
  summary: "Update user profile by ID",
  description: "Update the profile fields of the authenticated user.",
  tags: ["Users"],
  security: [{ bearerAuth: [] }],
  request: {
    params: UserIdParams,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: UpdateUserBody,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Profile updated successfully.",
      content: {
        "application/json": {
          schema: UserResponse,
        },
      },
    },
    400: { description: "Invalid input data." },
    401: { description: "Unauthorized — missing or invalid JWT token." },
    403: { description: "You cannot update another user's profile." },
    404: { description: "User not found." },
  },
});
  
  registry.registerPath({
    method: "get",
    path: "/api/users/search",
    summary: "Search for users by username or screen name",
    description:
      "Searches for users whose username or display name matches the provided query (case-insensitive).",
    tags: ["Users"],
    request: {
      query: SearchUserQuery,
    },
    responses: {
      200: {
        description: "Matching users retrieved successfully.",
        content: {
          "application/json": {
            schema: z.array(SearchUserResponse),
          },
        },
      },
      400: { description: "Missing or invalid search query." },
    },
  });

  registry.registerPath({
    method: "patch",
    path: "/api/users/profile-picture/{mediaId}",
    summary: "Update user profile picture by media ID",
    description:
      "Allows the authenticated user to update their profile picture by providing the media ID of the uploaded photo.",
    tags: ["Users"],
    security: [{ bearerAuth: [] }],
    request: {
      params: MediaIdParams,
    },
    responses: {
      200: {
        description: "Profile picture updated successfully.",
        content: {
          "application/json": {
            schema: UserResponse,
          },
        },
      },
      400: { description: "Invalid or missing media ID." },
      401: { description: "Unauthorized — missing or invalid JWT token." },
      403: { description: "You cannot update another user's photo." },
      404: { description: "User or media not found." },
    },
  });

  registry.registerPath({
    method: "delete",
    path: "/api/users/profile-picture",
    summary: "Delete user profile picture (restore default)",
    description:
      "Removes the authenticated user’s current profile picture and restores the default one.",
    tags: ["Users"],
    security: [{ bearerAuth: [] }],
    responses: {
      200: {
        description: "Profile picture restored to default.",
        content: { "application/json": { schema: UserResponse } },
      },
      401: { description: "Unauthorized — missing or invalid JWT token." },
      404: { description: "User not found." },
    },
  });

registry.registerPath({
  method: "patch",
  path: "/api/users/banner/{coverId}",
  summary: "Update user banner by media ID",
  description:
    "Allows the authenticated user to update their banner (cover image) by providing the media ID of the uploaded image.",
  tags: ["Users"],
  security: [{ bearerAuth: [] }],
  request: { params: CoverIdParams },
  responses: {
    200: {
      description: "Profile banner updated successfully.",
      content: { "application/json": { schema: UserResponse } },
    },
    400: { description: "Invalid or missing cover ID." },
    401: { description: "Unauthorized — missing or invalid JWT token." },
    403: { description: "You cannot update another user's banner." },
    404: { description: "User or media not found." },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/users/banner",
  summary: "Delete user banner (restore default)",
  description:
    "Removes the authenticated user’s current banner (cover image) and restores the default one.",
  tags: ["Users"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Profile banner restored to default.",
      content: { "application/json": { schema: UserResponse } },
    },
    401: { description: "Unauthorized — missing or invalid JWT token." },
    404: { description: "User not found." },
  },
});

};