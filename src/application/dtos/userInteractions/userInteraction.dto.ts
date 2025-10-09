import z from "zod";
import { UserInteractionParamsSchema } from "./userInteraction.dto.schema";

// Define DTO types
export type UserInteractionParams = z.infer<typeof UserInteractionParamsSchema>;
