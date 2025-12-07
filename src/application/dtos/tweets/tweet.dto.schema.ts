import z from "zod";
import { ReplyControl, TweetType } from "@/prisma/client";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { CategoriesResponseSchema } from "../explore/explore.dto.schema";

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
  .trim()
  .min(1, { message: "Content must not be empty" })
  .max(445);

const UserSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1, { message: "Content must not be empty" }).nullable(),
  username: StringSchema,
  profileMedia: z.object({ id: z.uuid() }),
  verified: z.boolean(),
  protectedAccount: z.boolean(),
  isFollowed: z.boolean(),
});

export const UsersResponseSchema = z.object({
  data: z.array(UserSchema),
  cursor: z.string().nullable(),
});

export const CreateTweetDTOSchema = z
  .object({
    content: StringSchema,
    replyControl: z.enum(ReplyControl).optional(),
    mediaIds: z
      .array(z.uuid())
      .max(4)
      .optional()
      .refine(
        (arr) => !arr || new Set(arr).size === arr.length,
        "Duplicate media IDs are not allowed"
      ),
  })
  .openapi("CreateTweetDTO");

const TweetMediaSchema = z
  .array(z.uuid())
  .max(4)
  .optional()
  .refine(
    (arr) => !arr || new Set(arr).size === arr.length,
    "Duplicate media IDs are not allowed"
  );

export const UpdateTweetSchema = z
  .object({
    content: StringSchema.optional(),
    replyControl: z.enum(ReplyControl).optional(),
    tweetMedia: TweetMediaSchema,
  })
  .refine(
    (data) => data.content || data.replyControl || data.tweetMedia?.length,
    {
      message:
        "At least one field (content, replyControl or tweetMedia) must be provided",
    }
  );

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
  tweetMedia: TweetMediaSchema,
  hashtags: z.array(z.string()).optional(),
  tweetCategories: CategoriesResponseSchema.optional(),
  isLiked: z.boolean(),
  isRetweeted: z.boolean(),
  isBookmarked: z.boolean(),
});

export const TweetListResponseSchema = z.object({
  data: z.array(TweetResponsesSchema),
  cursor: z.string().nullable(),
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
