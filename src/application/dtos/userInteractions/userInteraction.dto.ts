import z from "zod";
import {
  UserInteractionParamsSchema,
  FollowsListResponseSchema,
} from "./userInteraction.dto.schema";

// Define DTO types
export type UserInteractionParams = z.infer<typeof UserInteractionParamsSchema>;
export type FollowsListResponse = z.infer<typeof FollowsListResponseSchema>;
