import z from "zod";
import {
  CreateTweetDTOSchema,
  SearchDTOSchema,
  TimelineSchema,
} from "@/application/dtos/tweets/tweet.dto.schema";

export type CreateTweetDTO = z.infer<typeof CreateTweetDTOSchema>;

export type TimlineDTO = z.infer<typeof TimelineSchema>;

export type searchDTO = z.infer<typeof SearchDTOSchema>;
