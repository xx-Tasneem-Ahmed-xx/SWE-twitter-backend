import {
  OpenAPIRegistry,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import z from "zod";

extendZodWithOpenApi(z);

// ==================== PARAM SCHEMAS ==================== //
const UsernameParams = z.object({
  username: z.string().describe("Unique username of the user"),
});

const UserIdParams = z.object({
  userId: z.string().uuid().describe("Unique ID of the authenticated user"),
});

const UpdateUserParams = z.object({
  id: z.string().uuid().describe("Unique ID of the user to update"),
});

const MediaIdParams = z.object({
  userId: z.string().uuid().describe("Unique ID of the authenticated user"),
  mediaId: z
    .string()
    .uuid()
    .describe("Unique ID of the media to set as profile photo"),
});

const BannerIdParams = z.object({
  userId: z.string().uuid().describe("Unique ID of the authenticated user"),
  mediaId: z
    .string()
    .uuid()
    .describe("Unique ID of the media to set as the banner"),
});

// ==================== BODY SCHEMAS ==================== //
const UpdateUserBody = z.object({
  bio: z.string().optional().describe("User biography text"),
  website: z.string().optional().describe("Personal website URL"),
  protectedAccount: z
    .boolean()
    .optional()
    .describe("Whether the account is protected"),
  address: z.string().optional().describe("User address"),
  name: z.string().optional().describe("User's full name"),
  username: z.string().optional().describe("User's unique username"),
});

// ==================== RESPONSE SCHEMAS ==================== //
const MediaResponse = z.object({
  id: z.string().uuid(),
  name: z.string(),
  keyName: z.string(),
  type: z.string(),
});

const UserResponse = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  username: z.string(),
  email: z.string().optional(),
  bio: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  verified: z.boolean(),
  address: z.string().nullable().optional(),
  protectedAccount: z.boolean(),
  joinDate: z.string().optional(),
  profileMediaId: z.string().uuid().nullable().optional(),
  profileMedia: MediaResponse.nullable().optional(),
  coverMediaId: z.string().uuid().nullable().optional(),
  coverMedia: MediaResponse.nullable().optional(),
});

// ==================== SEARCH RESPONSE ==================== //
const SearchUserQuery = z.object({
  query: z.string().min(1).describe("Part of username or name to search for"),
});

const SearchUserResponse = z.object({
  id: z.string().uuid(),
  username: z.string(),
  name: z.string().nullable(),
  verified: z.boolean(),
  bio: z.string().nullable().optional(),
  profileMedia: z
    .object({
      id: z.string().uuid(),
      keyName: z.string(),
    })
    .nullable()
    .optional(),
  _count: z
    .object({
      followers: z.number(),
    })
    .optional(),
  isFollower: z.boolean().optional(),
  isFollowing: z.boolean().optional(),
});

// ==================== FCM SCHEMAS ==================== //
const AddFcmTokenDTOSchema = z.object({
  token: z.string().describe("Firebase Cloud Messaging token"),
});

const FcmTokenResponseDTOSchema = z.object({
  id: z.string().uuid(),
  token: z.string(),
  createdAt: z.string().optional(),
});

// ==================== REGISTER OPENAPI PATHS ==================== //

export const registerUserDocs = (registry: OpenAPIRegistry) => {
  // Get user profile
  registry.registerPath({
    method: "get",
    path: "/api/users/{username}",
    summary: "Get user profile by username",
    description: "Fetch the profile of a user by their username.",
    tags: ["Users"],
    request: {
      params: UsernameParams,
    },
    responses: {
      200: {
        description: "User profile fetched successfully.",
        content: {
          "application/json": { schema: UserResponse },
        },
      },
      401: { description: "Unauthorized access." },
      404: { description: "User not found." },
    },
  });

  // Update user profile
  registry.registerPath({
    method: "patch",
    path: "/api/users/{id}",
    summary: "Update user profile",
    description: "Update the authenticated user's profile information.",
    tags: ["Users"],
    security: [{ bearerAuth: [] }],
    request: {
      params: UpdateUserParams,
      body: {
        required: true,
        content: {
          "application/json": { schema: UpdateUserBody },
        },
      },
    },
    responses: {
      200: {
        description: "Profile updated successfully.",
        content: {
          "application/json": { schema: UserResponse },
        },
      },
      400: { description: "Invalid input data." },
      401: { description: "Unauthorized access." },
      403: { description: "Forbidden — cannot update another user's profile." },
    },
  });

  // Search users
  registry.registerPath({
    method: "get",
    path: "/api/users/search",
    summary: "Search users",
    description: "Search users by name or username (case-insensitive).",
    tags: ["Users"],
    request: {
      query: SearchUserQuery,
    },
    responses: {
      200: {
        description: "Matching users retrieved successfully.",
        content: {
          "application/json": { schema: z.array(SearchUserResponse) },
        },
      },
      400: { description: "Invalid or missing query." },
    },
  });

  // Update profile picture
  registry.registerPath({
    method: "patch",
    path: "/api/users/profile-picture/{userId}/{mediaId}",
    summary: "Update user profile picture",
    description:
      "Update the authenticated user's profile picture by specifying a media ID.",
    tags: ["Users"],
    security: [{ bearerAuth: [] }],
    request: { params: MediaIdParams },
    responses: {
      200: {
        description: "Profile picture updated successfully.",
        content: {
          "application/json": { schema: UserResponse },
        },
      },
      400: { description: "Invalid or missing media ID." },
      401: { description: "Unauthorized access." },
    },
  });

  // Delete profile picture
  registry.registerPath({
    method: "delete",
    path: "/api/users/profile-picture/{userId}",
    summary: "Delete user profile picture",
    description:
      "Remove the authenticated user's profile picture (restores default).",
    tags: ["Users"],
    security: [{ bearerAuth: [] }],
    request: { params: UserIdParams },
    responses: {
      200: {
        description: "Profile picture removed successfully.",
        content: {
          "application/json": { schema: UserResponse },
        },
      },
      401: { description: "Unauthorized access." },
    },
  });

  // Update banner
  registry.registerPath({
    method: "patch",
    path: "/api/users/banner/{userId}/{mediaId}",
    summary: "Update user banner",
    description:
      "Update the authenticated user's profile banner using a media ID.",
    tags: ["Users"],
    security: [{ bearerAuth: [] }],
    request: { params: BannerIdParams },
    responses: {
      200: {
        description: "Banner updated successfully.",
        content: {
          "application/json": { schema: UserResponse },
        },
      },
      400: { description: "Invalid or missing media ID." },
      401: { description: "Unauthorized access." },
    },
  });

  // Delete banner
  registry.registerPath({
    method: "delete",
    path: "/api/users/banner/{userId}",
    summary: "Delete user banner",
    description:
      "Remove the authenticated user's profile banner (restores default).",
    tags: ["Users"],
    security: [{ bearerAuth: [] }],
    request: { params: UserIdParams },
    responses: {
      200: {
        description: "Profile banner removed successfully.",
        content: {
          "application/json": { schema: UserResponse },
        },
      },
      401: { description: "Unauthorized access." },
    },
  });
  // Add FCM Token
  registry.registerPath({
    method: "post",
      path: "/api/users/fcm-token",
      summary: "Add FCM Token",
    description: "Add a Firebase Cloud Messaging (FCM) token for push notifications.",
    tags: ["Users"],
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        required: true,
        content: {
          "application/json": { schema: AddFcmTokenDTOSchema },
        },
      },
    },  
    responses: {
      200: {
        description: "FCM token added successfully.",
        content: {
          "application/json": { schema: FcmTokenResponseDTOSchema },
        },
      },
      400: { description: "Invalid input data." },
      401: { description: "Unauthorized access." },
    },
  });

};
