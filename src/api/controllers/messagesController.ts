import { Request, Response, NextFunction } from "express";
import prisma from "../../database";
import {
  ChatInput,
  chatGroupUpdate,
  MessageData,
  newMessageInput,
} from "../../application/dtos/chat/messages.dto";
import { MediaType } from "@/prisma/client";
import { socketService } from "@/app";
import {sendPushNotification} from '@/application/services/FCMService';
import { AppError } from "@/errors/AppError";


const getUnseenMessagesCountofChat = async (chatId: string, userId: string) => {
    try {
        const unseenMessagesCount = await prisma.message.count({
                where: {
                    chatId: chatId,
                    userId: { not: userId },
                    status: { not: 'READ' }
                }
            });
            return unseenMessagesCount;
    } catch (error) {
        
    }
}

const CreateChatFun = async (DMChat: boolean, participant_ids: string[]) => {
    try{
        //ceating DM chat
        const newChat = await prisma.chat.create({
            data: {
                DMChat: DMChat,
                chatUsers: {
                    create: participant_ids.map(id => ({ userId: id }))
                },
            }
        })
        if(!DMChat){
            const users = await prisma.user.findMany({
                where: {
                    id: { in: participant_ids }
                },
                select: { name: true }
            });
            const groupName = users.map((user) => user.name).join(', ');
            await prisma.chatGroup.create({
                data: {
                    chatId: newChat.id,
                    name: groupName
                }
            })
        }
        return newChat;
    }catch(error){
            return error;
    }

}


export const getChatInfo = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const chatId = req.params.chatId;
        if (!chatId) {
            throw new AppError('Chat ID is required', 400);
        }

        const chatInfo = await prisma.chat.findUnique({
            where: { id: chatId },
            include: {
                messages: {
                    take: 50,
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                name: true,
                                profileMediaId: true,
                                coverMediaId: true
                            }
                        },
                        messageMedia: {
                            include: {
                                media: true
                            }
                        }
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
                                coverMediaId: true
                            }
                        }
                    }
                },
                chatGroup: {
                    select: {
                        name: true,
                        photo: true,
                        description: true
                    }
                }
            }
        });

        if (!chatInfo) {
            throw new AppError('invalid chatId', 404);
        }               
        res.status(200).json(chatInfo);
    } catch (error) {
        console.error(' Error fetching chat info:', error);
        next(error);
    }
};


export const getChatMessages = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const chatId = req.params.chatId;
        const { lastMessageTimestamp } = req.body;
        if (!chatId || !lastMessageTimestamp) {
            throw new AppError('Chat ID and lastMessage timestamp are required', 400);
        }
        const chatExists = await prisma.chat.findUnique({
            where: { id: chatId }
        });
        if (!chatExists) {
            throw new AppError('invalid chatId', 404);
        }
        const messages = await prisma.message.findMany({
            where: {
                chatId: chatId,
                createdAt: {
                    gt: lastMessageTimestamp
                }
            },
            include: {
                user: {
                        select: {
                            id: true,
                            username: true,
                            name: true,
                            profileMediaId: true,
                            coverMediaId: true
                        }
                },
                messageMedia: {
                    include: {
                        media: true
                    }
                }
            },
            take: 50
        });
        res.status(200).json(messages);
    } catch (error) {
        next(error);
    }
}


export const getUserChats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        if (!userId) {
            throw new AppError('User ID is required', 400);
        }
        const userChatsID = await prisma.chatUser.findMany({
            where: {
                userId: userId
            },
            select: {
                chatId: true
            }
        });

        const userChats = await prisma.chat.findMany({
            where: {
                id: { in: userChatsID.map((chat: { chatId: string }) => chat.chatId) }
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
                                coverMediaId: true
                            }
                        }
                    }
                },
                chatGroup: {
                    select: {
                        name: true,
                        photo: true,
                        description: true
                    }
                }
            }
        });
        for (const chat of userChats) {
            const unseenCount = await getUnseenMessagesCountofChat(chat.id, userId);
            (chat as any).unseenMessagesCount = unseenCount;
        }
        res.status(200).json(userChats);
    } catch (error) {
        console.error('Error fetching user chats:', error);
        next(error);
    }
}


export const updateMessageStatus = async (chatId: string, userId: string) => {
  try {
    if (chatId) {
      await prisma.message.updateMany({
        where: {
          chatId: chatId,
          status: { not: "READ" },
          userId: { not: userId }
        },
        data: {
          status: "READ",
        },
      });
      return true;
    }
  } catch (error) {
      console.error("Error updating message status:", error);
    return false;
  }
};


export const createChat = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const{ DMChat, participant_ids }: ChatInput = req.body;
        const userId = (req as any).user.id;
        if(DMChat === undefined || participant_ids.length === 0 || participant_ids === undefined){
            throw new AppError('Missing chat type or participants id', 400);
        }
        
        if(participant_ids.length < 2 && DMChat === false){
            throw new AppError('At least two participants are required to create a chat group', 400);
        }
        for (const id of participant_ids) {
            const user = await prisma.user.findUnique({
                where: { id: id }
            });
            if (!user) {
                throw new AppError(`User with ID ${id} not found`, 404);
            }
        }
        participant_ids.push(userId as string);
        const newChat = await CreateChatFun(DMChat, participant_ids);
        if(newChat !== undefined){
            return res.status(201).json({ newChat });
        }
    } catch (error) {
        console.error('Error creating chat group:', error);
        next(error);
    }
}


export const deleteChat = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const chatId = req.params.chatId;
        if (chatId) {
            // Use transaction to ensure data consistency
            await prisma.$transaction(async (tx) => {
                // First, delete all messages in the chat
                await tx.message.deleteMany({
                    where: { chatId: chatId }
                });
                
                // Then, delete all chat users relationships
                await tx.chatUser.deleteMany({
                    where: { chatId: chatId }
                });
                await tx.chatGroup.deleteMany({
                    where: { chatId: chatId }
                });

                // Finally, delete the chat
                await tx.chat.delete({
                    where: { id: chatId }
                });
            });
            
            res.status(200).json({ message: 'Chat deleted successfully' });
        } else {
            throw new AppError('Chat ID is required', 400);
        }
    } catch (error) {
        console.error('Error deleting chat:', error);
        next(error);
    }
}


export const updateChatGroup = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const chatId = req.params.chatId;
        const { name, description, photo } : chatGroupUpdate = req.body;
        if(chatId){
            const existingChatGroup = await prisma.chatGroup.findUnique({
                where: { chatId: chatId }
            });
            if (!existingChatGroup) {
                throw new AppError('invalid chatId', 404);
            }
            const updatedChatGroup = await prisma.chatGroup.update({
                where: { chatId: chatId },
                data: {
                    name: name || existingChatGroup.name,
                    description: description || existingChatGroup.description,
                    photoId: photo || existingChatGroup.photoId
                }
            });
            res.status(200).json({ updatedChatGroup });
        }else{
            throw new AppError('Chat ID is required', 400);
        }
    }catch(error){
        console.error('Error updating chat group:', error);
        next(error);
    }
}


export const addMessageToChat = async (messageInput: newMessageInput, userId: string) => {
    try {
        const recipientId = messageInput.recipientId as Array<string> || [];
        const chatId = messageInput.chatId;
        if (!messageInput.data || !messageInput.data.content) {
            throw new AppError('Message content is required', 400);
        }
        let chat: any;
        if (!chatId && recipientId.length > 0) {
            if(recipientId.length === 1){
                const existingChat = await prisma.chat.findFirst({
                    where: {
                        DMChat: true,
                        chatUsers: {
                            every: {
                                userId: {
                                    in: [userId, ...recipientId]
                                }
                            }
                        }
                    }
                });
                if (existingChat) {
                    chat = existingChat;
                } else {
                    chat = await CreateChatFun(true, [userId, ...recipientId]);
                }
            }else{
                chat = await CreateChatFun(true, [userId, ...recipientId]);
            }
        }else if(chatId){
            chat = await prisma.chat.findUnique({
                where: { id: chatId }
            });
            if(!chat){
                throw new AppError('invalid chatId', 404);
            }
        }
        else{
            throw new AppError('missing chatId or recipientId', 400);
        }
        const newMessage = await prisma.message.create({
            data: {
                chatId: chat.id,
                userId: userId,
                content: messageInput.data.content,
                status: 'PENDING',
            }
        });
        if(messageInput.data.messageMedia && messageInput.data.messageMedia.length > 0){
            for(const mediaRaw of messageInput.data.messageMedia){
                // If mediaRaw is a Zod schema, parse it first
                let mediaObj: any;
                if (typeof mediaRaw.safeParse === 'function') {
                    const result = mediaRaw.safeParse(mediaRaw);
                    mediaObj = result.success ? result.data : {};
                } else {
                    mediaObj = mediaRaw;
                }
                
                const createdMedia = await prisma.media.create({
                    data: {
                        keyName: mediaObj.keyName || '',
                        type: mediaObj.type as MediaType || 'IMAGE' as MediaType,
                        name: mediaObj.name || '',
                        size: mediaObj.size || 0
                    }
                });
                await prisma.messageMedia.create({
                    data: {
                        messageId: newMessage.id,
                        mediaId: createdMedia.id
                    }
                });
            }
        }
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                username: true,
            }
        });
        await prisma.user.update({
            where: { id: userId },
            data: {
                unseenChatCount: { increment: 1 }
            }
        });
        for(const recipient of recipientId){
            await prisma.user.update({
                where: { id: recipient },
                data: {
                    unseenChatCount: { increment: 1 }
                }
            });
            //to handle website socket message sending
            if(socketService.checkSocketStatus(recipient)){
                socketService.sendMessageToChat(recipient, newMessage);
            }
            //handle offline user notification
            const userFCMTokens = await prisma.fcmToken.findMany({
                where: { userId: recipient.toString() },
            });
            const fcmTokens = userFCMTokens.length > 0 ? userFCMTokens.map(t => t.token).flat() : [];
            if (fcmTokens && fcmTokens.length > 0) {
                const notificationPayload = {
                    title: `New message from ${user?.username}`,
                    body: messageInput.data.content,
                };
                const dataPayload = {
                    chatId: newMessage.chatId,
                    messageId: newMessage.id,
                    content: messageInput.data.content,
                    senderId: userId,
                } as Record<string, string>;
                const tokensToDelete = await sendPushNotification(fcmTokens, notificationPayload, dataPayload);
                if (tokensToDelete.length > 0) {
                    await prisma.fcmToken.deleteMany({
                        where: {
                            token: { in: tokensToDelete },
                        },
                    });
                }
            }
        }
    }catch(error){
        console.error('Error adding message to chat:', error);
        return error;
    }
}
    
// Get total unseen messages count for the user across all chats
    export const getUnseenMessagesCountOfUser = async (req: Request, res: Response, next: NextFunction) => {
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
                                status: { not: 'READ' },
                                userId: { not: userId }
                            }
                        }
                    }
                }
            }
        })
        const unseenMessagesCounts = chats.map(chat => chat.chat.messages.length);
        totalUnseenMessages = unseenMessagesCounts.reduce((acc, count) => acc + count, 0);
        res.status(200).json({ totalUnseenMessages });
    } catch (error) {
        console.error('Error fetching unseen messages count of user:', error);
        next(error);
    }
}


//get unseen messages count in a specific chat
export const getUnseenMessagesCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const chatId = req.params.chatId;
        const userId = (req as any).user.id;
        if (chatId) {
            const unseenMessagesCount = await getUnseenMessagesCountofChat(chatId, userId);
            res.status(200).json({ unseenMessagesCount: unseenMessagesCount });
        } else {
            throw new AppError('Chat ID is required', 400);
        }
    } catch (error) {
        console.error('Error fetching unseen messages count:', error);
        next(error);    
    }
}