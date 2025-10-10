import { Server as SocketIOServer, Socket } from 'socket.io';
import prisma from '../../database';
// import jwt from 'jsonwebtoken'; // TODO: Install and uncomment when implementing JWT authentication

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
            // Extract token from socket handshake
            const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
            
            if (!token) {
                console.log('No token provided in socket connection');
                return null;
            }
            //TODO: Verify token here-------------------------->>>>>>>>>>>
            // In production, verify JWT token here
            // const decoded = jwt.verify(token, process.env.JWT_SECRET!);
            // return decoded.userId;
            
            // For now, return mock user ID
            return 'userB-123';
        } catch (error) {
            console.error('Token verification failed:', error);
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
        return usersId?.chatUsers.map((user) => user.userId) || [];
    }
    
    private setupUserEvents(socket: Socket, userId: string): void {
        // Handle sending messages
        socket.on('send-message', async(data: { chatId: string; message: string }) => {
            // Broadcast message to all users in the chat room
            const usersId = (await this.getAllUsers(data.chatId)).filter(id => id !== userId);
            for(const id of usersId){
                socket.to(id).emit('new-message', {
                    userId,
                    chatId: data.chatId,
                    message: data.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Handle typing indicators
        socket.on('typing', async (data: { userId: string; chatId: string; isTyping: boolean }) => {
            const usersId = (await this.getAllUsers(data.chatId)).filter(id => id !== userId);
            for(const id of usersId){
            socket.to(id).emit('user-typing', {
                userId,
                chatId: data.chatId,
                isTyping: data.isTyping
            });
        }
        });

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



//needed here: verify token function, and handle userId