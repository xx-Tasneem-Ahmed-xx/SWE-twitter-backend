// src/application/dtos/timeline/timeline.dto.schema.ts
import z from "zod";

/* ---------------------------
 * DTO Interfaces (for the service/schema consistency)
 * --------------------------- */

export interface UserMediaDTO {
  id: string;
}

export interface UserDTO {
  id: string;
  name: string | null;
  username: string;
  profileMedia: UserMediaDTO | null;
  verified: boolean;
  protectedAccount: boolean;
  retweets?: {
    data: { id: string; name: string | null; username: string }[];
    nextCursor: string | null;
  };
}

export interface EmbeddedTweetDTO {
  id: string;
  content: string | null;
  createdAt: string;
  likesCount: number;
  retweetCount: number;
  repliesCount: number;
  quotesCount: number;
  replyControl: string;
  tweetType: string;
  userId: string;
  user: UserDTO;
  mediaIds: string[];
}

export interface TimelineItemDTO {
  id: string;
  content: string | null;
  createdAt: string;
  likesCount: number;
  retweetCount: number;
  repliesCount: number;
  quotesCount: number;
  replyControl: string;
  parentId?: string | null;
  tweetType: string;
  user: UserDTO;
  mediaIds: string[];
  isLiked: boolean;
  isRetweeted: boolean;
  isBookmarked: boolean;
  score: number;
  reasons: string[];
  parentTweet?: EmbeddedTweetDTO | null;

  retweets?: {
    data: {
      id: string;
      name: string | null;
      username: string;
      profileMedia: UserMediaDTO | null;
      verified: boolean;
      protectedAccount: boolean;
    }[];
    nextCursor: string | null;
  };
}

/* ---------------------------
 * Zod Schemas
 * --------------------------- */

// Schema for parsing query params in the controller
export const CursorDTOSchema = z
  .object({
    cursor: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .strict();
