import z from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

const StringSchema = z
  .string()
  .min(1, { message: "This field cannot be empty" });

export const UpdateUserProfileDTOSchema = z
  .object({
    name: StringSchema.optional(),
    username: StringSchema.optional(),
    bio: StringSchema.optional(),
    address: StringSchema.optional(),
    website: StringSchema.optional(),
    protectedAccount: z.boolean().optional(),
    profilePhoto: z.string().url().optional(),
    cover: z.string().url().optional(),
  })
  .openapi("UpdateUserProfileDTO");

export const UserResponseDTOSchema = z
  .object({
    id: z.string().uuid(),
    name: StringSchema.optional().nullable(),
    username: StringSchema,
    email: z.string().email(),
    bio: StringSchema.optional().nullable(),
    dateOfBirth: z.date(),
    joinDate: z.date(),
    verified: z.boolean(),
    address: StringSchema.optional().nullable(),
    website: StringSchema.optional().nullable(),
    protectedAccount: z.boolean(),
    profilePhoto: z.string().url().optional().nullable(),
    cover: z.string().url().optional().nullable(),
  })
  .openapi("UserProfileResponseDTO");

export const SearchUserQuerySchema = z
  .object({
    query: z.string().min(1, "Query cannot be empty"),
  })
  .openapi("SearchUserQueryDTO");

export const SearchUserResponseDTOSchema = z
  .object({
    id: z.string().uuid(),
    username: z.string(),
    name: z.string().nullable(),
    profilePhoto: z.string().url().nullable().optional(),
    verified: z.boolean(),
  })
  .openapi("SearchUserResponseDTO");

export const UpdateUserProfilePhotoParamsSchema = z
  .object({
    mediaId: z
      .string()
      .uuid({ message: "Invalid media ID format" })
      .describe("Unique ID of the uploaded media to set as profile picture"),
  })
  .openapi("UpdateUserProfilePhotoParamsDTO");

export const UpdateUserBannerParamsSchema = z
  .object({
    coverId: z
      .string()
      .uuid({ message: "Invalid cover ID format" })
      .describe("Unique ID of the uploaded media to set as cover/banner"),
  })
  .openapi("UpdateUserBannerParamsDTO");