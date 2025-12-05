import z from "zod";
import {
  CategoryCursorSchema,
  PreferredCategoriesSchema,
} from "@/application/dtos/explore/explore.dto.schema";

export type PreferredCategorieDTO = z.infer<typeof PreferredCategoriesSchema>;

export type CategoryCursorDTO = z.infer<typeof CategoryCursorSchema>;
