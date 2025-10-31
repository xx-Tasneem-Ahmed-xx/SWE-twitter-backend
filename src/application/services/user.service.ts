import prisma from "../../database";
import { UpdateUserProfileDTO, UserProfileResponseDTO } from "../dtos/user.dto";
import { OSType } from "@prisma/client";
export class UserService {
  /**
   * Get user profile by username
   */
  async getUserProfile(
    username: string,
    viewerId: string
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
        profileMediaId: true,
        coverMediaId: true,

        profileMedia: {
          select: {
            id: true,
            name: true,
            keyName: true,
            type: true,
          },
        },
        coverMedia: {
          select: {
            id: true,
            name: true,
            keyName: true,
            type: true,
          },
        },

        _count: {
          select: {
            followers: true,
            followings: true,
          },
        },
      },
    });

    if (!user) return null;

    // Convert Date -> string
    const serializedUser = {
      ...user,
      joinDate: user.joinDate.toISOString(),
      dateOfBirth: user.dateOfBirth.toISOString(),
    };

    if (user.id === viewerId) {
      return {
        ...serializedUser,
        isFollower: false,
        isFollowing: false,
      };
    }

    const [isFollowerRelation, isFollowingRelation] = await Promise.all([
      prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: user.id,
            followingId: viewerId,
          },
        },
      }),
      prisma.follow.findUnique({
        where: {
          followerId_followingId: {
            followerId: viewerId,
            followingId: user.id,
          },
        },
      }),
    ]);

    return {
      ...serializedUser,
      isFollower: !!isFollowerRelation,
      isFollowing: !!isFollowingRelation,
    };
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
        dateOfBirth: data.dateOfBirth,
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

    return {
      ...updatedUser,
      joinDate:
        updatedUser.joinDate instanceof Date
          ? updatedUser.joinDate.toISOString()
          : updatedUser.joinDate,
      dateOfBirth:
        updatedUser.dateOfBirth != null
          ? updatedUser.dateOfBirth instanceof Date
            ? updatedUser.dateOfBirth.toISOString()
            : updatedUser.dateOfBirth
          : null,
    };
  }

  /**
   * Search for users by name or username
   */
  async searchUsers(
    query: string,
    viewerId: string,
    pageSize: number = 10,
    cursor?: string
  ) {
    if (!query.trim()) return { users: [], nextCursor: null };

    // STEP 1 — Find all users matching the query in username or name
    const results = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
        ],
        NOT: { id: viewerId }, // exclude current user
      },
      select: {
        id: true,
        username: true,
        name: true,
        verified: true,
        bio: true,
        profileMedia: {
          select: { id: true, keyName: true },
        },
        _count: {
          select: { followers: true },
        },
      },
    });

    // STEP 2 — Compute a "relevance score" similar to X
    const queryLower = query.toLowerCase();
    const scored = results.map((user) => {
      let score = 0;

      const usernameLower = user.username.toLowerCase();
      const nameLower = (user.name ?? "").toLowerCase();

      if (usernameLower.startsWith(queryLower)) score += 5;
      else if (nameLower.startsWith(queryLower)) score += 4;
      else if (usernameLower.includes(queryLower)) score += 3;
      else if (nameLower.includes(queryLower)) score += 2;

      if (user.verified) score += 2;

      score += Math.min(user._count.followers, 500) / 100; // small boost cap

      return { ...user, score };
    });

    // STEP 3 — Sort by score descending (like Twitter relevance)
    scored.sort((a, b) => b.score - a.score);

    // STEP 4 — Apply pagination manually (cursor = last seen user id)
    let startIndex = 0;
    if (cursor) {
      const cursorIndex = scored.findIndex((u) => u.id === cursor);
      if (cursorIndex !== -1) startIndex = cursorIndex + 1;
    }

    const paginated = scored.slice(startIndex, startIndex + pageSize);
    const nextCursor =
      startIndex + pageSize < scored.length
        ? scored[startIndex + pageSize].id
        : null;

    // STEP 5 — Add isFollowing / isFollower context
    const enrichedUsers = await Promise.all(
      paginated.map(async (user) => {
        const [isFollowing, isFollower] = await Promise.all([
          prisma.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: viewerId,
                followingId: user.id,
              },
            },
          }),
          prisma.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: user.id,
                followingId: viewerId,
              },
            },
          }),
        ]);

        return {
          ...user,
          isFollowing: !!isFollowing,
          isFollower: !!isFollower,
        };
      })
    );

    return {
      users: enrichedUsers,
      nextCursor,
    };
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
  // insert fcm token in fcm_tokens table
  async addFcmToken(userId: string, token: string, osType: OSType) {
    const existingToken = await prisma.fcmToken.findUnique({
      where: { token },
    });

    if (existingToken) {
      // If token exists, just update its userId and osType (if needed)
      return prisma.fcmToken.update({
        where: { token },
        data: { userId, osType },
      });
    }

    // Otherwise create a new one
    return prisma.fcmToken.create({
      data: {
        token,
        osType,
        userId,
      },
    });
  }
}
