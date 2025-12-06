import { Request, Response, NextFunction } from "express";
import prisma from "../../database";
import * as responseUtils from "@/application/utils/response.utils";
import {
  ChatInput,
  chatGroupUpdate,
  newMessageInput,
} from "../../application/dtos/chat/messages.dto";
import { socketService } from "@/app";
import { sendPushNotification } from "@/application/services/FCMService";
import { AppError } from "@/errors/AppError";
import { any } from "zod";
import { get } from "http";

const getUnseenMessagesCountofChat = async (chatId: string, userId: string) => {
  try {
    const unseenMessagesCount = await prisma.message.count({
      where: {
        chatId: chatId,
        userId: { not: userId },
        status: { not: "READ" },
      },
    });
    return unseenMessagesCount;
  } catch (error) {}
};

export const CreateChatFun = async (
  DMChat: boolean,
  participant_ids: string[]
) => {
  try {
    //ceating DM chat
    const newChat = await prisma.chat.create({
      data: {
        DMChat: DMChat,
        chatUsers: {
          create: participant_ids.map((id) => ({ userId: id })),
        },
      },
    });
    if (!DMChat) {
      const users = await prisma.user.findMany({
        where: {
          id: { in: participant_ids },
        },
        select: { name: true },
      });
      const groupName = users.map((user) => user.name).join(", ");
      await prisma.chatGroup.create({
        data: {
          chatId: newChat.id,
          name: groupName,
        },
      });
    }
    return await prisma.chat.findUnique({
      where: { id: newChat.id },
      include: {
        chatUsers: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                profileMediaId: true,
                coverMediaId: true,
              },
            },
          },
        },
        chatGroup: {
          select: {
            name: true,
            photo: true,
            description: true,
          },
        },
      },
    });
  } catch (error) {
    return error;
  }
};

export const getChatInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const chatId = req.params.chatId;
    if (!chatId) {
      responseUtils.throwError("CHAT_ID_REQUIRED");
    }

    const chatInfo = await prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        messages: {
          take: 50,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                profileMediaId: true,
                coverMediaId: true,
              },
            },
            messageMedia: {
              include: {
                media: true,
              },
            },
          },
        },
        chatUsers: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                profileMediaId: true,
                coverMediaId: true,
              },
            },
          },
        },
        chatGroup: {
          select: {
            name: true,
            photo: true,
            description: true,
          },
        },
      },
    });

    if (!chatInfo) {
      responseUtils.throwError("INVALID_CHAT_ID");
    }
    res.status(200).json(chatInfo);
  } catch (error) {
    next(error);
  }
};

export const getChatMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const chatId = req.query.chatId as string;

    const { lastMessageTimestamp } = req.query as {
      lastMessageTimestamp?: string;
    };
    if (!chatId || !lastMessageTimestamp) {
      responseUtils.throwError("CHAT_ID_AND_LASTMESSAGE_REQUIRED");
    }
    const chatExists = await prisma.chat.findUnique({
      where: { id: chatId },
    });
    if (!chatExists) {
      responseUtils.throwError("INVALID_CHAT_ID");
    }
    const messages = await prisma.message.findMany({
      where: {
        chatId: chatId,
        createdAt: {
          lt: lastMessageTimestamp,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            profileMediaId: true,
            coverMediaId: true,
          },
        },
        messageMedia: {
          include: {
            media: true,
          },
        },
      },
      take: 50,
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
};

export const getUserChats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user.id;
    if (!userId) {
      responseUtils.throwError("USER_ID_REQUIRED");
    }
    const userChatsID = await prisma.chatUser.findMany({
      where: {
        userId: userId,
      },
      select: {
        chatId: true,
      },
    });

    const userChats = await prisma.chat.findMany({
      where: {
        id: { in: userChatsID.map((chat: { chatId: string }) => chat.chatId) },
      },
      include: {
        chatUsers: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                name: true,
                profileMediaId: true,
                coverMediaId: true,
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        chatGroup: {
          select: {
            name: true,
            photo: true,
            description: true,
          },
        },
      },
    });
    for (const chat of userChats) {
      const unseenCount = await getUnseenMessagesCountofChat(chat.id, userId);
      (chat as any).unseenMessagesCount = unseenCount;
    }
    res.status(200).json(userChats);
  } catch (error) {
    next(error);
  }
};

export const updateMessageStatus = async (chatId: string, userId: string) => {
  try {
    if (chatId) {
      const unseenMessagesCount = await getUnseenMessagesCountofChat(chatId, userId);
      if (unseenMessagesCount === 0) {
        return true;
      }
      await prisma.message.updateMany({
        where: {
          chatId: chatId,
          status: { not: "READ" },
          userId: { not: userId },
        },
        data: {
          status: "READ",
        },
      });
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          unseenChatCount: { decrement: 1 },
        },
      });
      socketService.sendUnseenChatsCount(
        userId,
        updatedUser.unseenChatCount
      );
      return true;
    }
  } catch (error) {
    return false;
  }
};

export const createChat = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { DMChat, participant_ids }: ChatInput = req.body;
    const userId = (req as any).user.id;
    if (
      DMChat === undefined ||
      participant_ids.length === 0 ||
      participant_ids === undefined
    ) {
      responseUtils.throwError("MISSING_CHAT_TYPE_OR_PARTICIPANTS");
    }

    if (participant_ids.length < 2 && DMChat === false) {
      responseUtils.throwError("PARTICIPANTS_REQUIRED_FOR_GROUP_CHAT");
    }
    for (const id of participant_ids) {
      const user = await prisma.user.findUnique({
        where: { id: id },
      });
      if (!user) {
        responseUtils.throwError("USER_NOT_FOUND_WITH_ID");
      }
    }
    participant_ids.push(userId as string);
    const oldChat = await prisma.chat.findFirst({
      where: {
        DMChat: true,
        chatUsers: {
          every: {
            userId: {
              in: participant_ids,
            },
          },
        },
      },
    });
    if (oldChat) {
      return res.status(200).json({ newChat: oldChat });
    }
    const newChat = await CreateChatFun(DMChat, participant_ids);
    if (newChat !== undefined) {
      return res.status(201).json({ newChat });
    }
  } catch (error) {
    next(error);
  }
};

export const deleteChat = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const chatId = req.params.chatId;
    if (chatId) {
      const chatUsers = await prisma.chatUser.findMany({
        where: { chatId: chatId },
      });
      await prisma.$transaction(async (tx) => {
        await tx.message.deleteMany({
          where: { chatId: chatId },
        });

        await tx.chatUser.deleteMany({
          where: { chatId: chatId },
        });
        await tx.chatGroup.deleteMany({
          where: { chatId: chatId },
        });

        await tx.chat.delete({
          where: { id: chatId },
        });
      });
      //send this event to notify the other users about deleted chat
      for (const chatUser of chatUsers) {
        if (chatUser.userId !== (req as any).user.id) {
          socketService.sendDletedChatToUser(chatUser.userId, chatId);
        }
      }
      socketService.sendDletedChatToUser((req as any).user.id, chatId);

      return responseUtils.sendResponse(res, "CHAT_DELETED");
    } else {
      responseUtils.throwError("CHAT_ID_REQUIRED");
    }
  } catch (error) {
    console.error("Error deleting chat:", error);
    next(error);
  }
};

export const updateChatGroup = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const chatId = req.params.chatId;
    const { name, description, photo }: chatGroupUpdate = req.body;
    if (chatId) {
      const existingChatGroup = await prisma.chatGroup.findUnique({
        where: { chatId: chatId },
      });
      if (!existingChatGroup) {
        responseUtils.throwError("INVALID_CHAT_ID");
      }
      const updatedChatGroup = await prisma.chatGroup.update({
        where: { chatId: chatId },
        data: {
          name: name || existingChatGroup!.name,
          description: description || existingChatGroup!.description,
          photoId: photo || existingChatGroup!.photoId,
        },
      });
      res.status(200).json({ updatedChatGroup });
    } else {
      responseUtils.throwError("CHAT_ID_REQUIRED");
    }
  } catch (error) {
    console.error("Error updating chat group:", error);
    next(error);
  }
};

export const addMessageToChat = async (
  messageInput: newMessageInput,
  userId: string
) => {
  try {
    const recipientId = (messageInput.recipientId as Array<string>) || [];
    const chatId = messageInput.chatId;
    if (!messageInput.data || !messageInput.data.content) {
      responseUtils.throwError("MESSAGE_CONTENT_REQUIRED");
    }
    let chat: any;
    if (!chatId && recipientId.length > 0) {
      if (recipientId.length === 1) {
        const existingChat = await prisma.chat.findFirst({
          where: {
            DMChat: true,
            chatUsers: {
              every: {
                userId: {
                  in: [userId, ...recipientId],
                },
              },
            },
          },
        });
        if (existingChat) {
          chat = existingChat;
        } else {
          chat = await CreateChatFun(true, [userId, ...recipientId]);
        }
      } else {
        chat = await CreateChatFun(true, [userId, ...recipientId]);
      }
    } else if (chatId) {
      chat = await prisma.chat.findUnique({
        where: { id: chatId },
      });
      if (!chat) {
        responseUtils.throwError("INVALID_CHAT_ID");
      }
    } else {
      responseUtils.throwError("MISSING_CHAT_ID_OR_RECIPIENT_ID");
    }

    let newMessage = await prisma.message.create({
      data: {
        chatId: chat.id,
        userId: userId,
        content: messageInput.data.content!,
        status: "SENT",
        createdAt: messageInput.createdAt,
      },
    });
    if (
      messageInput.data.messageMedia &&
      messageInput.data.messageMedia.length > 0
    ) {
      for (const mediaRaw of messageInput.data.messageMedia) {
        let mediaObj: any;
        if (mediaRaw && typeof (mediaRaw as any).safeParse === "function") {
          const result = (mediaRaw as any).safeParse(mediaRaw);
          mediaObj = result.success ? result.data : {};
        } else {
          mediaObj = mediaRaw;
        }

        await prisma.messageMedia.create({
          data: {
            messageId: newMessage.id,
            mediaId: mediaObj.mediaId,
          },
        });
      }
    }
    const createdMessage = await prisma.message.findUniqueOrThrow({
      where: { id: newMessage.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        messageMedia: {
          include: {
            media: true,
          },
        },
      },
    });
    let usersId = await socketService.getAllUsers(chat.id);
    usersId = usersId.filter((id) => id !== userId);

    for (const recipient of usersId) {
      const unseenMessagesCount = await getUnseenMessagesCountofChat(
        chat.id,
        recipient
      );
      if (unseenMessagesCount == null) continue;
      //check if this is the first unseen message in this chat to increment unseenChatCount
      let updatedUser = null;
      if ((unseenMessagesCount ?? 0) - 1 <= 0) {
        updatedUser = await prisma.user.update({
          where: { id: recipient },
          data: {
            unseenChatCount: { increment: 1 },
          },
        });
      }
      //to handle website socket message sending
      if (socketService.checkSocketStatus(recipient)) {
        socketService.sendMessageToChat(recipient, {
          createdMessage,
          unseenMessagesCount: unseenMessagesCount,
        });
        socketService.sendUnseenChatsCount(
          recipient,
          (updatedUser as any)?.unseenChatCount || 0
        );
      }
      //handle offline user notification
      const userFCMTokens = await prisma.fcmToken.findMany({
        where: { userId: recipient.toString() },
      });
      const fcmTokens =
        userFCMTokens.length > 0
          ? userFCMTokens.map((t) => t.token).flat()
          : [];
      if (fcmTokens && fcmTokens.length > 0) {
        const notificationPayload = {
          title: `New message from ${createdMessage.user?.name || "Someone"}`,
          body: messageInput.data.content!,
        };
        const dataPayload = {
          chatId: createdMessage.chatId,
          messageId: createdMessage.id,
          content: messageInput.data.content!,
          senderId: userId,
          unseenChatCount: (updatedUser as any)?.unseenChatCount || 0,
          unseenMessagesCount: unseenMessagesCount.toString(),
        } as Record<string, string>;
        const tokensToDelete = await sendPushNotification(
          fcmTokens,
          notificationPayload,
          dataPayload
        );
        if (tokensToDelete.length > 0) {
          await prisma.fcmToken.deleteMany({
            where: {
              token: { in: tokensToDelete },
            },
          });
        }
      }
    }
    return newMessage.id;
  } catch (error) {
    console.error("Error adding message to chat:", error);
    return error;
  }
};

// Get total unseen messages count for the user across all chats
export const getUnseenMessagesCountOfUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user.id;
    let totalUnseenMessages = 0;
    const chats = await prisma.chatUser.findMany({
      where: { userId: userId },
      include: {
        chat: {
          include: {
            messages: {
              where: {
                status: { not: "READ" },
                userId: { not: userId },
              },
            },
          },
        },
      },
    });
    const unseenMessagesCounts = chats.map((chat) => chat.chat.messages.length);
    totalUnseenMessages = unseenMessagesCounts.reduce(
      (acc, count) => acc + count,
      0
    );
    res.status(200).json({ totalUnseenMessages });
  } catch (error) {
    console.error("Error fetching unseen messages count of user:", error);
    next(error);
  }
};

//get unseen messages count in a specific chat
export const getUnseenMessagesCount = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const chatId = req.params.chatId;
    const userId = (req as any).user.id;
    if (chatId) {
      const unseenMessagesCount = await getUnseenMessagesCountofChat(
        chatId,
        userId
      );
      res.status(200).json({ unseenMessagesCount: unseenMessagesCount });
    } else {
      responseUtils.throwError("CHAT_ID_REQUIRED");
    }
  } catch (error) {
    console.error("Error fetching unseen messages count:", error);
    next(error);
  }
};
