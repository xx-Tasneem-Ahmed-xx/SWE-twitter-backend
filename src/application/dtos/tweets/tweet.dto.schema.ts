import z from "zod";
import { ReplyControl, TweetType } from "@prisma/client";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

const StringSchema = z
  .string()
  .min(1, { message: "Content must not be empty" });

const UserSchema = z.object({
  id: z.uuid(),
  name: StringSchema,
  username: StringSchema,
  profilePhoto: z.url(),
  verified: z.boolean(),
  protectedAccount: z.boolean(),
});

export const CreateTweetDTOSchema = z
  .object({
    userId: z.uuid(),
    content: StringSchema,
    replyControl: z.enum(ReplyControl).optional(),
  })
  .openapi("CreateTweetDTO");

export const CreateRetweetDTOSchema = z.object({
  userId: z.uuid(),
  parentId: z.uuid(),
});

export const CreateReplyOrQuoteDTOSchema = CreateTweetDTOSchema.extend({
  parentId: z.uuid(),
});

export const TweetResponsesSchema = z.object({
  id: z.uuid(),
  content: StringSchema,
  createdAt: z.date(),
  likesCount: z.int(),
  retweetCount: z.int(),
  repliesCount: z.int(),
  replyControl: z.enum(ReplyControl),
  parentId: z.uuid().optional(),
  tweetType: z.enum(TweetType),
  user: UserSchema,
});

export const UsersResponseSchema = z.object({
  users: z.array(UserSchema),
});

export const TweetSummaryResponse = z.object({
  id: z.uuid(),
  tweetId: z.uuid(),
  summary: StringSchema,
});

export const HashTagResponseSchema = z.array(
  z.object({
    hash: z.object({ id: z.uuid(), tag_text: StringSchema }),
  })
);
