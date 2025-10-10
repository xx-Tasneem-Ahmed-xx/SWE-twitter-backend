import z from "zod";
import {
  CreateTweetDTOSchema,
  CreateRetweetDTOSchema,
} from "@/application/dtos/tweets/tweet.dto.schema";

export type CreateTweetDTO = z.infer<typeof CreateTweetDTOSchema>;

export type CreateRetweetDTO = z.infer<typeof CreateRetweetDTOSchema>;
