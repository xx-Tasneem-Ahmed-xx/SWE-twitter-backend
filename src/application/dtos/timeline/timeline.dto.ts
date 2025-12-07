// src/application/dtos/timeline/timeline.dto.ts
import { TimelineItemDTO } from "./timeline.dto.schema";

/* ---------------------------
 * Types & DTOs (from original file)
 * --------------------------- */

// Note: Interfaces for UserMediaDTO, UserDTO, EmbeddedTweetDTO, etc., are moved to timeline.dto.schema.ts
// for Zod-to-OpenAPI generation, but we re-export the primary ones for use here and in the service.

// The TimelineItemDTO is also imported from the schema file as it's the core output structure.

export interface TimelineResponse {
  user: string;
  items: TimelineItemDTO[];
  nextCursor: string | null;
  generatedAt: string;
}

export interface ForYouResponseDTO extends TimelineResponse {
  recommendations: TimelineItemDTO[];
}

export type TimelineParams = {
  userId: string;
  limit?: number;
  cursor?: string;
  includeThreads?: boolean;
};

export type ForYouParams = { userId: string; limit?: number; cursor?: string };

// Internal utility types
export interface InteractionData {
  isLiked: boolean;
  isRetweeted: boolean;
  isBookmarked: boolean;
  mediaIds: string[];
}
export type InteractionMap = Map<string, InteractionData>;

/**
 * TUNABLE constants (from original file)
 */
export const CONFIG = {
  // Common
  cacheTTL: 8, // seconds
  randomNoiseStddev: 0.015,
  authorReputationCap: 2.0,
  diversityAuthorLimit: 3,

  // For You Feed Specific
  recencyHalfLifeHours_FY: 18,
  engagementWeights_FY: { like: 1.0, retweet: 2.2, reply: 0.8 },
  followBoost: 2.6,
  twoHopBoost: 1.25,
  followingLikedBoost: 1.7,
  bookmarkByFollowingBoost: 1.5,
  topicMatchBoost: 1.9,
  verifiedBoost_FY: 1.12,
  candidateLimit_FY: 1500,
  trendingLimit_FY: 300,
  trendingWindowHours: 48,
  authorReputationFloor_FY: 0.2,

  // Following Feed Specific
  recencyHalfLifeHours_F: 24,
  engagementWeights_F: { like: 1.0, retweet: 2.3, reply: 0.9, quote: 1.2 },
  retweetByFollowingBoost: 1.05,
  quoteByFollowingBoost: 1.03,
  velocityBoostFactor: 0.06,
  verifiedBoost_F: 1.08,
  authorReputationFloor_F: 0.25,
  candidateLimit_F: 1200,
  spamReportPenaltyPerReport: 0.5,
  threadIncludeLimit: 3,
};
