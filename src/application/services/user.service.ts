import prisma from "../../database";
import { UpdateUserProfileDTO, UserProfileResponseDTO } from "../dtos/user.dto";

export class UserService {
  /**
   * Get user profile by username
   */
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

        // new fields based on schema
        profileMediaId: true,
        profileMedia: {
          select: {
            id: true,
            name: true,
            keyName: true,
            type: true,
          },
        },
        coverMediaId: true,
        coverMedia: {
          select: {
            id: true,
            name: true,
            keyName: true,
            type: true,
          },
        },
      },
    });
    return user;
  }

  /**
   * Update user's general profile information
   */
  async updateUserProfile(
    id: string,
    data: UpdateUserProfileDTO
  ): Promise<UserProfileResponseDTO> {
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        username: data.username,
        bio: data.bio,
        address: data.address,
        website: data.website,
        protectedAccount: data.protectedAccount,
        // note: profileMediaId and coverMediaId are updated via dedicated methods below
      },
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
        profileMediaId: true,
        profileMedia: {
          select: {
            id: true,
            name: true,
            keyName: true,
            type: true,
          },
        },
        coverMediaId: true,
        coverMedia: {
          select: {
            id: true,
            name: true,
            keyName: true,
            type: true,
          },
        },
      },
    });

    return updatedUser;
  }

  /**
   * Search for users by name or username
   */
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
        verified: true,
        profileMediaId: true,
        profileMedia: {
          select: {
            id: true,
            keyName: true,
            type: true,
          },
        },
      },
      take: 10,
    });

    return users;
  }

  /**
   * Update user's profile photo using mediaId
   */
  async updateProfilePhoto(userId: string, mediaId: string) {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profileMediaId: mediaId },
      select: {
        id: true,
        name: true,
        username: true,
        verified: true,
        profileMediaId: true,
        profileMedia: {
          select: {
            id: true,
            name: true,
            keyName: true,
            type: true,
          },
        },
      },
    });

    return updatedUser;
  }

  /**
   * Delete user's profile photo (reset to default)
   */

  async deleteProfilePhoto(userId: string) {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profileMediaId: null }, // TODO Removes profile photo (restores default)
      select: {
        id: true,
        name: true,
        username: true,
        verified: true,
        profileMediaId: true,
        profileMedia: true,
      },
    });
    return updatedUser;
  }
  /**
   * Update user's profile banner using mediaId
   */
  async updateProfileBanner(userId: string, coverId: string) {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { coverMediaId: coverId },
      select: {
        id: true,
        name: true,
        username: true,
        verified: true,
        coverMediaId: true,
        coverMedia: {
          select: {
            id: true,
            name: true,
            keyName: true,
            type: true,
          },
        },
      },
    });

    return updatedUser;
  }
  /**
   * Delete (reset) user's profile banner to default
   */
  async deleteProfileBanner(userId: string) {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { coverMediaId: null }, // TODO Removes banner (restores default)
      select: {
        id: true,
        name: true,
        username: true,
        verified: true,
        coverMediaId: true,
        coverMedia: true,
      },
    });

    return updatedUser;
  }
}
