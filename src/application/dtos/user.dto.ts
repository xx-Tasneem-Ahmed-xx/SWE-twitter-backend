import z from "zod";
import {
  UpdateUserProfileDTOSchema,
  UserResponseDTOSchema,
  SearchUserQuerySchema,
  SearchUserResponseDTOSchema,
  UpdateUserProfilePhotoParamsSchema,
  UpdateUserBannerParamsSchema,
  AddFcmTokenDTOSchema,
  FcmTokenResponseDTOSchema,
} from "./user.dto.schema";

export type UpdateUserProfileDTO = z.infer<typeof UpdateUserProfileDTOSchema>;
export type UserProfileResponseDTO = z.infer<typeof UserResponseDTOSchema>;
export type SearchUserQueryDTO = z.infer<typeof SearchUserQuerySchema>;
export type SearchUserResponseDTO = z.infer<typeof SearchUserResponseDTOSchema>;
export type UpdateUserProfilePhotoDTO = z.infer<
  typeof UpdateUserProfilePhotoParamsSchema
>;
export type UpdateUserBannerDTO = z.infer<typeof UpdateUserBannerParamsSchema>;
export type AddFcmTokenDTO = z.infer<typeof AddFcmTokenDTOSchema>;
export type FcmTokenResponseDTO = z.infer<typeof FcmTokenResponseDTOSchema>;
// optional addition (for pagination support in search)
export type PaginatedSearchUserResponse = {
  users: SearchUserResponseDTO[];
  nextCursor: string | null;
};
