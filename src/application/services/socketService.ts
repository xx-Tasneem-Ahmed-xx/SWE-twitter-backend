import { Server as SocketIOServer, Socket } from 'socket.io';
import prisma from '../../database';
import * as utils from '../utils/tweets/utils';
import { redisClient } from '../../config/redis';
import { addMessageToChat, updateMessageStatus } from '@/api/controllers/messagesController';
import { markNotificationsAsRead } from '@/api/controllers/notificationController';
import { newMessageInput } from '../dtos/chat/messages.dto';

export class SocketService {
    public io: SocketIOServer;

    constructor(io: SocketIOServer) {
        this.io = io;
        this.setupSocketConnections();
    }

    private setupSocketConnections(): void {
        this.io.on('connection', (socket: Socket) => {
            console.log('New socket connection established:', socket.id);
            this.handleUserConnection(socket);
        });
    }

    private async handleUserConnection(socket: Socket): Promise<void> {
        try {
            // Authenticate user from token
            const userId = await this.authenticateSocket(socket);
            
            if (userId) {
                socket.join(userId);
                console.log(`User ${userId} joined their private room.`);

                socket.data.userId = userId;

                this.setupUserEvents(socket, userId);

                socket.emit('authenticated', { userId, message: 'Successfully connected' });
            } else {
                throw new Error('Authentication failed');
            }
        } catch (error) {
            console.error('Socket authentication failed:', error);
            socket.emit('auth-error', { message: 'Authentication failed' });
            socket.disconnect();
        }
    }

    private async authenticateSocket(socket: Socket): Promise<string | null> {
        try {
            const raw = (socket.handshake.auth?.token as string | undefined)
                || (socket.handshake.headers?.authorization as string | undefined)
                || '';

            if (!raw) {
                console.log('No token provided in socket connection');
                return null;
            }
            const token = raw.startsWith('Bearer ') ? raw.substring('Bearer '.length).trim() : raw.trim();
            const validationResult = utils.ValidateToken(token);
            const { ok, payload, err } = validationResult;
            if (!ok || !payload) {
                console.error('Socket token validation failed:', err);
                return null;
            }
            const version = payload.version ?? (payload as any).tokenVersion;
            if (version === null || version === undefined) {
                console.error('Token missing version');
                return null;
            }
            const email = payload.email;
            if (!email) {
                console.error('Token missing email');
                return null;
            }

            const user = await prisma.user.findFirst({ where: { email } });
            if (!user) {
                console.error('User not found for token email');
                return null;
            }

            if ((user.tokenVersion ?? 0) !== Number(version)) {
                console.warn('Token version mismatch - user may have logged out');
                return null;
            }

            // Check if token is blacklisted (same as Auth middleware)
            const jti = payload.jti;
            if (jti) {
                const exists = await redisClient.exists(`Blocklist:${jti}`);
                if (exists === 1) {
                    console.warn('Token is blacklisted (user logged out)');
                    return null;
                }
            }

            const userId = payload.id as string;
            if (!userId) {
                console.error('Token missing user id');
                return null;
            }

            socket.data.userId = userId;
            socket.data.email = email;
            socket.data.username = (payload as any).Username || payload.username;
            
            return userId;
        } catch (error) {
            console.error('Socket authentication error:', error);
            return null;
        }
    }

    private async getAllUsers(chatId: string): Promise<string[]> {
        const usersId = await prisma.chat.findUnique({
            where: {
                id: chatId
            },
            select: {
                chatUsers: {
                    select: {
                        userId: true
                    }
                }
            }
        })
        return usersId?.chatUsers.map((user: { userId: string }) => user.userId) || [];
    }
    
    private setupUserEvents(socket: Socket, userId: string): void {

        socket.on('typing', async (data: {chatId: string; isTyping: boolean }) => {
            const usersId = (await this.getAllUsers(data.chatId)).filter(id => id !== userId);
            for(const id of usersId){
            socket.to(id).emit('user-typing', {
                userId,
                chatId: data.chatId,
                isTyping: data.isTyping
            });
        }
        });

        socket.on('open-chat', async (data: { chatId: string }) => {
            await updateMessageStatus(data.chatId);
        })

        socket.on('open-notification', async(data: { notificationId: string }) => {
            try {
                await markNotificationsAsRead(data.notificationId);
            } catch (error) {
                console.error('Error marking notification as read:', error);
            }
        });

        socket.on('add-message', async (data: { message: newMessageInput }) => {
            try {
                await addMessageToChat(data.message, userId);
            } catch (error) {
                console.error('Error adding message to chat via socket:', error);
            }
        });

        socket.on('disconnect', () => {
            console.log(`User ${userId} disconnected from socket ${socket.id}`);
            // Additional cleanup can be done here if necessary
        });

    }

    public checkSocketStatus(userID: string): boolean {
        const room = this.io.sockets.adapter.rooms.get(userID);
        return room !== undefined && room.size > 0;
    }

    public sendNotificationToUser(recipientId: string, notification: any): void {
        this.io.to(recipientId).emit('notification', notification);
    }

    public sendMessageToChat(recipientId: string, message: any): void {
        this.io.to(recipientId).emit('new-message', message);
    }


    public getConnectedUsersCount(): number {
        return this.io.sockets.sockets.size;
    }
}