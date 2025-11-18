import z from "zod";
import {
  TrendsQuerySchema,
  HashtagTweetsQuerySchema,
  TrendItemSchema,
  TrendsResponseSchema,
  HashtagTweetsResponseSchema,
} from "./trend.dto.schema";

// Infer types from schemas
export type TrendsQuery = z.infer<typeof TrendsQuerySchema>;
export type HashtagTweetsQuery = z.infer<typeof HashtagTweetsQuerySchema>;
export type TrendItem = z.infer<typeof TrendItemSchema>;
export type TrendsResponse = z.infer<typeof TrendsResponseSchema>;
export type HashtagTweetsResponse = z.infer<typeof HashtagTweetsResponseSchema>;
