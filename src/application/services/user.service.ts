
import prisma from "../../database";
import { UpdateUserProfileDTO, UserProfileResponseDTO } from "../dtos/user.dto";

export class UserService {
  async getUserProfile(
    username: string
  ): Promise<UserProfileResponseDTO | null> {
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

  async searchUsers(query: string) {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        username: true,
        name: true,
        profilePhoto: true,
        verified: true,
      },
      take: 10,
    });

    return users;
  }
}


