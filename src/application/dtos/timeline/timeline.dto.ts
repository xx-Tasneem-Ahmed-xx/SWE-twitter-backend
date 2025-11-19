import z from "zod";
import { TimelineQuerySchema, ForYouQuerySchema } from "./timeline.dto.schema";

export type TimelineQueryDTO = z.infer<typeof TimelineQuerySchema>;
export type ForYouQueryDTO = z.infer<typeof ForYouQuerySchema>;

export type TimelineServiceDTO = {
  userId: string;
} & TimelineQueryDTO;

export type ForYouServiceDTO = {
  userId: string;
} & ForYouQueryDTO;
