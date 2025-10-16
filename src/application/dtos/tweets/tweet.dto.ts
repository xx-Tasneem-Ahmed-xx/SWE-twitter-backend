import z from "zod";
import {
  CreateTweetDTOSchema,
  TimelineSchema,
} from "@/application/dtos/tweets/tweet.dto.schema";

export type CreateTweetDTO = z.infer<typeof CreateTweetDTOSchema>;

export type TimlineDTO = z.infer<typeof TimelineSchema>;
