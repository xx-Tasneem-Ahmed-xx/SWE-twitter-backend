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





const getUnseenMessages = async (chatId: string) => {
  try {
    const unseenMessages = await prisma.message.findMany({
      where: {
        chatId: chatId,
        status: {
          not: "READ",
        },
      },
      include: {
        user: {
          select: {
            id: true,
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
    if (unseenMessages) {
      return unseenMessages;
    }
    return [];
  } catch (error) {
    return error;
  }
};

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
            return res.status(400).json({ error: 'Chat ID is required' });
        }

        const chatInfo = await prisma.chat.findUnique({
            where: { id: chatId },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' },
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
                    }
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
            return res.status(404).json({ error: 'Chat not found' });
        }               
        res.status(200).json(chatInfo);
    } catch (error ) {
        console.error(' Error fetching messages:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};


export const getUserChats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
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
        if (!userChats) {
            return res.status(404).json({ error: 'No chats found for this user' });
        }
        res.status(200).json(userChats);
    } catch (error) {
        console.error('Error fetching user chats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export const getUnseenMessagesCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const chatId = req.params.chatId;
        if (chatId) {
            const unseenMessages = await getUnseenMessages(chatId);
            const unseenMessagesCount = (unseenMessages as any[]).length;
            if (unseenMessagesCount === undefined) {
                return res.status(404).json({ error: 'No unseen messages found' });
            }
                res.status(200).json({ unseenMessagesCount: unseenMessagesCount });
        } else {
            return res.status(400).json({ error: 'Chat ID is required' });
        }
    } catch (error) {
        console.error('Error fetching unseen messages count:', error);
     res.status(500).json({ error: 'Internal server error' });    
    }
}



export const updateMessageStatus = async (req: Request, res: Response) => {
  try {
    const chatId = req.params.chatId;
    if (chatId) {
      await prisma.message.updateMany({
        where: {
          chatId: chatId,
        },
        data: {
          status: "READ",
        },
      });
      res.status(200).json({ message: "Message status updated successfully" });
    }
  } catch (error) {
    console.error("Error updating message status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};




export const createChat = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const{ DMChat, participant_ids }: ChatInput = req.body;        
        const userId = req.user?.id;
        if(participant_ids.length < 2 && DMChat === false){
            return res.status(400).json({ error: 'At least two participants are required to create a chat' });
        }
        for (const id of participant_ids) {
            const user = await prisma.user.findUnique({
                where: { id: id }
            });
            if (!user) {
                return res.status(404).json({ error: `User with ID ${id} not found` });
            }
        }
        participant_ids.push(userId as string);
        const newChat = await CreateChatFun(DMChat, participant_ids);
        if(newChat !== undefined){
            return res.status(201).json({ newChat });
        }
    } catch (error) {
        console.error('Error creating chat group:', error);
        res.status(500).json({ error: 'Internal server error' });
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
            res.status(400).json({ error: 'Chat ID is required' });
        }
    } catch (error) {
        console.error('Error deleting chat:', error);
        res.status(500).json({ error: 'Internal server error' });
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
                return res.status(404).json({ error: 'Chat group not found' });
            }
            const updatedChatGroup = await prisma.chatGroup.update({
                where: { chatId: chatId },
                data: {
                    name: name || existingChatGroup.name,
                    description: description || existingChatGroup.description,
                    photo: photo || existingChatGroup.photo
                }
            });
            res.status(200).json({ updatedChatGroup });
        }else{
            res.status(400).json({ error: 'Chat ID is required' });
        }
    }catch(error){
        console.error('Error updating chat group:', error);
        res.status(500).json({ error: 'Internal server error' });   
    }
}

export const addMessageToChat = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id as string;
        const messageInput: newMessageInput = req.body;
        const recipientId = messageInput.recipientId as Array<string> || [];
        const chatId = messageInput.chatId;
        if (!messageInput.data || !messageInput.data.content) {
            return res.status(400).json({ error: 'Message content is required' });
        }
        let chat: any;
        if (!chatId && recipientId.length > 0) {
            if(recipientId.length === 1){
                //check if DM chat already exists
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
                return res.status(404).json({ error: 'Chat not found' });
            }
        }
        else{
            return res.status(400).json({ error: 'missing chatId or recipientId' });
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
        for(const recipient of recipientId){
            socketService.sendMessageToChat(recipient, newMessage);
        }
        res.status(201).json({ newMessage });
        
    }catch(error){
        console.error('Error adding message to chat:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export const getUnseenChatsCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.user?.id; //supposed to be from auth middleware
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        const userChats = await prisma.chatUser.findMany({
            where: { userId: userId },
            select: { chatId: true }
        });
        let unseenChatsCount = 0;
        for (const chat of userChats) {
            const lastMessage = await prisma.message.findFirst({
                where: { chatId: chat.chatId, userId: userId },
                orderBy: { createdAt: 'desc' }
            });
            if (lastMessage?.status !== 'READ') {
                unseenChatsCount++;
            }
        }
        res.status(200).json({ unseenChatsCount });
    } catch (error) {
        console.error('Error fetching unseen chats count:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}


///commented code for reference