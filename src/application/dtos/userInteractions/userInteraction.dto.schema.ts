import z from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const UserInteractionParamsSchema = z
  .object({
    username: z
      .string()
      .min(1, { message: "Username must not be empty" })
      .describe("Username of the user to interact with"),
  })
  .openapi("UserInteractionParams");
