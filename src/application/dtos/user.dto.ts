import z from "zod";
import {
  UpdateUserProfileDTOSchema,
  UserResponseDTOSchema,
} from "./user.dto.schema";

export type UpdateUserProfileDTO = z.infer<typeof UpdateUserProfileDTOSchema>;
export type UserProfileResponseDTO = z.infer<typeof UserResponseDTOSchema>;
