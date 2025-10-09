import { Request, Response, NextFunction } from "express";
import prisma from "../../database";
import {ChatInput, chatGroupUpdate, MessageData, newMessageInput} from '../../application/dtos/messages.dto';
import { MediaType } from "@prisma/client";

// Lazy import to avoid circular dependency
let socketService: any = null;
const getSocketService = () => {
    if (!socketService) {
        socketService = require('../../app').socketService;
    }
    return socketService;
};



const getUnseenMessages = async (chatId: string) => {
    try {
        const unseenMessages = await prisma.message.findMany({
            where: {
                chatId: chatId,
                status: {
                    not: 'READ'
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                    }
                },
                messageMedia: {
                    include: {
                        media: true
                    }
                }
            }
        })
        if(unseenMessages){
            return unseenMessages;
        }
        return [];
    } catch (error) {
        return error;
    }
}

const CreateChat = async (DMChat: boolean, participant_ids: string[], MessageData: any, userId: string) => {
    try{
        if(DMChat){
        //creating DM chat
            const existingChat = await prisma.chat.findFirst({
                where: {
                    DMChat: true,
                    chatUsers: {
                        some: {
                            userId: {
                                in: participant_ids
                            }
                        }
                    }
                }
            })  
            //if chat already exists between the two users, return the chat id
            if(existingChat){
                return existingChat.id;
            }
            var newChat;
            if(MessageData.content !== undefined){
                newChat = await prisma.chat.create({
                    data: {
                        DMChat: true,
                        chatUsers: {
                            create: participant_ids.map(id => ({ userId: id }))
                        },
                        messages: {
                            create: {
                                userId: userId,
                                content: MessageData.content,
                                messageMedia: {
                                    create: MessageData.messageMedia?.map((media: any) => ({
                                        media: {
                                            create: {
                                                name: media.name,
                                                url: media.url,
                                                type: media.type,
                                                size: media.size
                                            }
                                        }
                                    }))
                                }
                            }
                        }
                    }
                })
            }
            else{
                newChat = await prisma.chat.create({
                    data: {
                        DMChat: true,
                        chatUsers: {
                            create: participant_ids.map(id => ({ userId: id }))
                        },
                    }
                })
            }
            return newChat;
        }else{
            //creating group chat
            //assuming that creat a new chat group has no initial message and no group photo and description
            const names = await prisma.user.findMany({
                where: {
                    id: { in: participant_ids }
                },
                select: { name: true }
            })
            const currUser = await prisma.user.findUnique({
                where: { id: userId },
                select: { name: true }
            })
            const groupName = names.map(user => user.name).join(', ');
            groupName.concat(`, ${currUser?.name}`);
            const newChat = await prisma.chat.create({
                data: {
                    DMChat: true,
                    chatUsers: {
                        create: participant_ids.map(id => ({ userId: id }))
                    },
                    chatGroup: {
                        create: {
                            name: groupName,
                            description: '',
                            photo: '',
                        }
                    }
                }
            })
            return newChat;
        }
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
                                profilePhoto: true
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
                                profilePhoto: true
                            }
                        }
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

//get all chats for a user======>1
export const getUserChats = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = req.params.userId;
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
                id: { in: userChatsID.map(chat => chat.chatId) }
            },
            include: {
                chatUsers: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                username: true,
                                name: true,
                                profilePhoto: true
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
        res.status(200).json(userChats);
    } catch (error) {
        console.error('Error fetching user chats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

//get unseen messages count for a user in a chat
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



//update message status to READ=========>1
export const updateMessageStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const chatId = req.params.chatId;
        if(chatId){
        await prisma.message.updateMany({
            where: {
                chatId: chatId
            },
            data: {
                status: 'READ'
            }
        })
        res.status(200).json({ message: 'Message status updated successfully' });
    }
        
    } catch (error) {
        console.error('Error updating message status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
//get unseen messages for a user in a chat
// export const getUnseenMessagesForUser = async (req: Request, res: Response, next: NextFunction) => {
//     try { 
        
//     } catch (error) {
//         res.status(500).json({ error: 'Internal server error' });
//     }
// }



export const createChat = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const{ DMChat, MessageData, participant_ids }: ChatInput = req.body;
        const userId = req.params.userId;
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
        const newChat = await CreateChat(DMChat, participant_ids, MessageData, userId);
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
            await prisma.chat.delete({
                where: { id: chatId }
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
            const updatedChatGroup = await prisma.chatGroup.update({
                where: { chatId: chatId },
                data: {
                    name: name || '',
                    description: description || '',
                    photo: photo || ''
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


//add message to a chat on events=========>1
export const addMessageToChat = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId } = req.params;//supposed to be from auth middleware
        const messageInput: newMessageInput = req.body;
        const recipientId = messageInput.recipientId;
        const chatId = messageInput.chatId;
        if (!messageInput.data || !messageInput.data.content) {
            return res.status(400).json({ error: 'Message content is required' });
        }
        var chat: any;
        if (!chatId && recipientId) {
            chat = await CreateChat(true, [userId, ...recipientId], messageInput.data, userId);
        }else if(chatId){
            chat = await prisma.chat.findUnique({
                where: { id: chatId }
            });
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
            for(const media of messageInput.data.messageMedia){
                const createdMedia = await prisma.media.create({
                    data: {
                        url: media.url || '',
                        type: media.type as MediaType || 'IMAGE' as MediaType,
                        name: media.name || '',
                        size: media.size || 0
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
            getSocketService().sendMessageToChat(recipient, newMessage);
        }
        res.status(201).json({ newMessage });

    }catch(error){
        console.error('Error adding message to chat:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

//delete chat