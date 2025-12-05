import z from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const PreferredCategoriesSchema = z.object({
  categoryIds: z
    .array(z.uuid())
    .min(1)
    .refine(
      (arr) => !arr || new Set(arr).size === arr.length,
      "Duplicate category IDs are not allowed"
    ),
});

export const CategoryCursorSchema = z.object({
  limit: z.coerce.number().min(1).max(40).default(20),
  cursor: z.object({ id: z.uuid() }).optional(),
});
