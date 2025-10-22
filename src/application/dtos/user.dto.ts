import z from "zod";
import {
  UpdateUserProfileDTOSchema,
  UserResponseDTOSchema,
  SearchUserQuerySchema,
  SearchUserResponseDTOSchema,
  UpdateUserProfilePhotoDTOSchema,
} from "./user.dto.schema";

export type UpdateUserProfileDTO = z.infer<typeof UpdateUserProfileDTOSchema>;
export type UserProfileResponseDTO = z.infer<typeof UserResponseDTOSchema>;
export type SearchUserQueryDTO = z.infer<typeof SearchUserQuerySchema>;
export type SearchUserResponseDTO = z.infer<typeof SearchUserResponseDTOSchema>;
export type UpdateUserProfilePhotoDTO = z.infer<
  typeof UpdateUserProfilePhotoDTOSchema
>;
