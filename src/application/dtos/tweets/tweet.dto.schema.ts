import z from "zod";
import { ReplyControl, TweetType } from "@/prisma/client";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export enum PeopleFilter {
  ANYONE = "ANYONE",
  FOLLOWINGS = "FOLLOWINGS",
}

export enum SearchTab {
  TOP = "TOP",
  LATEST = "LATEST",
  PEOPLE = "PEOPLE",
  MEDIA = "MEDIA",
}

export const StringSchema = z
  .string()
  .min(1, { message: "Content must not be empty" });

const UserSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1, { message: "Content must not be empty" }).nullable(),
  username: StringSchema,
  profileMedia: z.object({ id: z.uuid(), keyName: z.string() }),
  verified: z.boolean(),
  protectedAccount: z.boolean(),
});

export const UsersResponseSchema = z.object({
  users: z.array(UserSchema),
});

export const CreateTweetDTOSchema = z
  .object({
    content: StringSchema,
    replyControl: z.enum(ReplyControl).optional(),
  })
  .openapi("CreateTweetDTO");

export const TweetResponsesSchema = z.object({
  id: z.uuid(),
  content: StringSchema,
  createdAt: z.date(),
  likesCount: z.int(),
  retweetCount: z.int(),
  repliesCount: z.int(),
  quotesCount: z.int(),
  replyControl: z.enum(ReplyControl),
  parentId: z.uuid().nullable().optional(),
  tweetType: z.enum(TweetType),
  user: UserSchema,
});

export const timelineResponeSchema = TweetResponsesSchema.extend({
  retweets: UsersResponseSchema,
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

export const CursorDTOSchema = z.object({
  limit: z.coerce.number().min(1).max(40).default(20),
  cursor: z.string().optional().describe("The cursor for pagination"),
});

export const TimelineSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export const SearchDTOSchema = z
  .object({
    query: StringSchema,
    peopleFilter: z.enum(PeopleFilter).default(PeopleFilter.ANYONE),
    searchTab: z.enum(SearchTab).default(SearchTab.TOP),
  })
  .extend(CursorDTOSchema.shape);
