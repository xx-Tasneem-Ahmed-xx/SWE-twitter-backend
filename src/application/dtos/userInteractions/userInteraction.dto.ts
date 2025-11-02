import z from "zod";
import {
  UserInteractionParamsSchema,
  FollowsListResponseSchema,
  UserInteractionQuerySchema,
} from "./userInteraction.dto.schema";

// Define DTO types
export type UserInteractionQuery = z.infer<typeof UserInteractionQuerySchema>;
export type UserInteractionParams = z.infer<typeof UserInteractionParamsSchema>;
export type FollowsListResponse = z.infer<typeof FollowsListResponseSchema>;
