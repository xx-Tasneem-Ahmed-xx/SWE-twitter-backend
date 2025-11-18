import z from "zod";
import {
  TrendQuerySchema,
  TrendItemSchema,
  TrendsResponseSchema,
  TrendTweetsResponseSchema,
} from "./trend.dto.schema";

// Infer types from schemas
export type TrendQuery = z.infer<typeof TrendQuerySchema>;
export type TrendItem = z.infer<typeof TrendItemSchema>;
export type TrendsResponse = z.infer<typeof TrendsResponseSchema>;
export type TrendTweetsResponse = z.infer<typeof TrendTweetsResponseSchema>;
