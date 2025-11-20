// src/application/dtos/timeline.dto.ts
import z from "zod";
import {
  CursorDTOSchema,
  TimelineItemSchema,
  ForYouResponseSchema,
  TimelineResponseSchema,
} from "./timeline.dto.schema";

export type CursorDTO = z.infer<typeof CursorDTOSchema>;
export type TimelineItemDTO = z.infer<typeof TimelineItemSchema>;
export type ForYouResponseDTO = z.infer<typeof ForYouResponseSchema>;
export type TimelineResponseDTO = z.infer<typeof TimelineResponseSchema>;
