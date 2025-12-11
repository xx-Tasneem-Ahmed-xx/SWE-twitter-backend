import z from "zod";
import {
  CreateTweetDTOSchema,
  CursorDTOSchema,
  SearchDTOSchema,
  TimelineSchema,
  UpdateTweetSchema,
} from "@/application/dtos/tweets/tweet.dto.schema";

export type CreateTweetDTO = z.infer<typeof CreateTweetDTOSchema>;

export type UpdateTweetDTO = z.infer<typeof UpdateTweetSchema>;

export type TimlineDTO = z.infer<typeof TimelineSchema>;

export type searchDTO = z.infer<typeof SearchDTOSchema>;

export type CursorDTO = z.infer<typeof CursorDTOSchema>;
