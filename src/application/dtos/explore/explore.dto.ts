import z from "zod";
import {
  CategoryCursorSchema,
  ExploreServiceSchema,
  PreferredCategoriesSchema,
} from "@/application/dtos/explore/explore.dto.schema";

export type PreferredCategorieDTO = z.infer<typeof PreferredCategoriesSchema>;

export type CategoryCursorDTO = z.infer<typeof CategoryCursorSchema>;

export type ExploreServiceDTO = z.infer<typeof ExploreServiceSchema>;
