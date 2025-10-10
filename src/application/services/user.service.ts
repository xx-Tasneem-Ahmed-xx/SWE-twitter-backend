
import prisma from "../../database";
import { UpdateUserProfileDTO, UserProfileResponseDTO } from "../dtos/user.dto";

export class UserService {
  async getUserProfile(username: string): Promise<UserProfileResponseDTO | null> {
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        bio: true,
        dateOfBirth: true,
        joinDate: true,
        verified: true,
        address: true,
        website: true,
        protectedAccount: true,
        profilePhoto: true,
        cover: true,
      },
    });
    return user;
  }

  async updateUserProfile(
    id: string,
    data: UpdateUserProfileDTO
  ): Promise<UserProfileResponseDTO> {
    const updatedUser = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        bio: true,
        dateOfBirth: true,
        joinDate: true,
        verified: true,
        address: true,
        website: true,
        protectedAccount: true,
        profilePhoto: true,
        cover: true,
      },
    });
    return updatedUser;
  }
}
