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
