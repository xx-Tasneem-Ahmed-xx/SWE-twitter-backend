// src/application/dtos/user.dto.ts

export interface UserProfileResponseDTO {
  id: string;
  name?: string | null;
  username: string;
  email: string;
  bio?: string | null;
  dateOfBirth: Date;
  joinDate: Date;
  verified: boolean;
  address?: string | null;
  website?: string | null;
  protectedAccount: boolean;
  profilePhoto?: string | null;
  cover?: string | null;
}

export interface UpdateUserProfileDTO {
  name?: string;
  bio?: string;
  address?: string;
  website?: string;
  protectedAccount?: boolean;
  profilePhoto?: string;
  cover?: string;
}
