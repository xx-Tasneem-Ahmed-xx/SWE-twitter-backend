import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { MediaType, MessageStatus } from "@prisma/client";
import { url } from "inspector";
extendZodWithOpenApi(z);

export const mediaSchema = z.object({
    name: z.string().min(1).max(255),
    url: z.string().url(),
    type: z.enum(MediaType),
    size: z.number().nullable()
})