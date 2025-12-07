import z from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

export const PreferredCategoriesSchema = z.object({
  categories: z
    .array(z.string())
    .min(1)
    .refine(
      (arr) => !arr || new Set(arr).size === arr.length,
      "Duplicate categories are not allowed"
    ),
});

export const CategoryCursorSchema = z.object({
  limit: z.coerce.number().min(1).max(40).default(20),
  cursor: z.object({ id: z.uuid() }).optional(),
});

export const ExploreServiceSchema = z.object({
  userId: z.uuid(),
  category: z.string().optional(),
  limit: z.coerce.number().min(1).max(40).default(20),
  cursor: z.object({ id: z.uuid(), score: z.coerce.number() }).optional(),
});

export const CategoriesResponseSchema = z.array(
  z.object({
    id: z.uuid(),
    name: z.string(),
  })
);
