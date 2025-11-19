import z, { date, email } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

const StringSchema = z
  .string()
  .min(1, { message: "This field cannot be empty" });

/* ==========================
   Update User Profile DTO
========================== */
export const UpdateUserProfileDTOSchema = z
  .object({
    name: StringSchema.optional(),
    username: StringSchema.optional(),
    bio: z.string().optional(),
    address: z.string().optional(),
    website: z
      .string()
      .optional()
      .refine(
        (val) =>
          !val || // allow undefined
          val === "" || // allow empty string
          /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/.test(val), // validate URL
        { message: "Invalid URL format" }
      ),
    protectedAccount: z.boolean().optional(),
    dateOfBirth: z
      .string()
      .optional()
      .refine((val) => val === "" || !!val, {
        message: "Invalid date of birth",
      }),
    email: z.string().email().optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(
        /[!@#$%^&*(),.?":{}|<>]/,
        "Password must contain at least one special character"
      )
      .optional(),

    // 👇 New fields for date of birth visibility settings
    dobMonthDayVisibility: z
      .enum([
        "PUBLIC",
        "YOUR_FOLLOWERS",
        "PEOPLE_YOU_FOLLOW",
        "YOU_FOLLOW_EACH_OTHER",
        "ONLY_YOU",
      ])
      .optional(),
    dobYearVisibility: z
      .enum([
        "PUBLIC",
        "YOUR_FOLLOWERS",
        "PEOPLE_YOU_FOLLOW",
        "YOU_FOLLOW_EACH_OTHER",
        "ONLY_YOU",
      ])
      .optional(),
  })
  .openapi("UpdateUserProfileDTO");


/* ==========================
   User Response DTO
========================== */
export const UserResponseDTOSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().nullable().optional(),
    username: z.string(),
    email: z.string().email().optional(),
    bio: z.string().nullable().optional(),
    dateOfBirth: z.string().nullable().optional(),
    joinDate: z.string(),
    verified: z.boolean(),
    address: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
    protectedAccount: z.boolean(),

    // Profile/Cover media
    profileMediaId: z.string().uuid().nullable().optional(),
    coverMediaId: z.string().uuid().nullable().optional(),

    profileMedia: z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        keyName: z.string(),
        type: z.enum(["IMAGE", "VIDEO", "GIF"]),
      })
      .nullable()
      .optional()
      .describe("Profile media object"),

    coverMedia: z
      .object({
        id: z.string().uuid(),
        name: z.string(),
        keyName: z.string(),
        type: z.enum(["IMAGE", "VIDEO", "GIF"]),
      })
      .nullable()
      .optional()
      .describe("Cover media object"),

    // Relationship info (counts and connection flags)
    _count: z
      .object({
        followers: z.number(),
        followings: z.number(),
      })
      .optional(),
    isFollower: z.boolean().optional(),
    isFollowing: z.boolean().optional(),

    // New attributes
    muted: z
      .boolean()
      .optional()
      .describe("Whether the viewer has muted this user"),
    blocked: z
      .boolean()
      .optional()
      .describe("Whether the viewer has blocked this user"),
  })
  .openapi("UserProfileResponseDTO");

/* ==========================
   Search Users
========================== */
export const SearchUserQuerySchema = z
  .object({
    query: z.string().min(1, "Query cannot be empty"),
    cursor: z.string().uuid().optional(),
    limit: z.number().min(1).max(50).default(10),
  })
  .openapi("SearchUserQueryDTO");

export const SearchUserResponseDTOSchema = z
  .object({
    id: z.string().uuid(),
    username: z.string(),
    name: z.string().nullable(),
    verified: z.boolean(),
    bio: z.string().nullable().optional(),
    profileMedia: z
      .object({
        id: z.string().uuid(),
        keyName: z.string(),
        type: z.enum(["IMAGE", "VIDEO", "GIF"]),
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
  })
  .openapi("SearchUserResponseDTO");

/* ==========================
   Profile Picture Update Params
========================== */
export const UpdateUserProfilePhotoParamsSchema = z
  .object({
    userId: z
      .string()
      .uuid({ message: "Invalid user ID format" })
      .describe("Unique ID of the user whose profile picture is being updated"),
    mediaId: z
      .string()
      .uuid({ message: "Invalid media ID format" })
      .describe("Unique ID of the uploaded media to set as profile picture"),
  })
  .openapi("UpdateUserProfilePhotoParamsDTO");

/* ==========================
   Banner Update Params
========================== */
export const UpdateUserBannerParamsSchema = z
  .object({
    userId: z
      .string()
      .uuid({ message: "Invalid user ID format" })
      .describe("Unique ID of the user whose banner is being updated"),
    mediaId: z
      .string()
      .uuid({ message: "Invalid media ID format" })
      .describe("Unique ID of the uploaded media to set as banner image"),
  })
  .openapi("UpdateUserBannerParamsDTO");

export const AddFcmTokenDTOSchema = z
  .object({
    token: z
      .string()
      .min(1, { message: "FCM token cannot be empty" })
      .describe("Firebase Cloud Messaging token"),
    osType: z
      .enum(["ANDROID", "IOS", "WEB"])
      .describe("Operating system type of the device"),
  })
  .openapi("AddFcmTokenDTO");

export const FcmTokenResponseDTOSchema = z
  .object({
    token: z.string(),
    osType: z.enum(["ANDROID", "IOS", "WEB"]),
    userId: z.string().uuid(),
    createdAt: z.string(),
  })
  .openapi("FcmTokenResponseDTO");