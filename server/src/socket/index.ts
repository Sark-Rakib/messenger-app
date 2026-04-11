import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AuthUser, ClientToServerEvents, ServerToClientEvents } from '../types/index.js';

const onlineUsers = new Map<string, string>();

interface ExtendedSocket extends Socket<ClientToServerEvents, ServerToClientEvents> {
  user?: AuthUser;
}

export function setupSocketHandlers(io: Server, prisma: PrismaClient) {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as AuthUser;
      (socket as ExtendedSocket).user = decoded;
      next();
    } catch {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: ExtendedSocket) => {
    const user = socket.user as AuthUser;
    console.log(`User connected: ${user.username}`);

    onlineUsers.set(user.id, socket.id);

    io.emit('userOnline', { userId: user.id });

    socket.on('joinConversation', async (conversationId: string) => {
      try {
        const isParticipant = await prisma.conversationParticipant.findFirst({
          where: {
            userId: user.id,
            conversationId,
          },
        });

        if (isParticipant) {
          socket.join(conversationId);
        }
      } catch (error) {
        console.error('Join conversation error:', error);
      }
    });

    socket.on('leaveConversation', (conversationId: string) => {
      socket.leave(conversationId);
    });

    socket.on('sendMessage', async (data) => {
      try {
        const { conversationId, content, attachmentUrl, attachmentType } = data;

        const isParticipant = await prisma.conversationParticipant.findFirst({
          where: {
            userId: user.id,
            conversationId,
          },
        });

        if (!isParticipant) return;

        const message = await prisma.message.create({
          data: {
            conversationId,
            senderId: user.id,
            content,
            attachmentUrl,
            attachmentType,
          },
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                avatar: true,
              },
            },
          },
        });

        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });

        io.to(conversationId).emit('message', {
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          sender: message.sender,
          content: message.content,
          attachmentUrl: message.attachmentUrl,
          attachmentType: message.attachmentType,
          createdAt: message.createdAt,
        });
      } catch (error) {
        console.error('Send message error:', error);
      }
    });

    socket.on('typing', (data) => {
      socket.to(data.conversationId).emit('typing', {
        conversationId: data.conversationId,
        userId: user.id,
        username: user.username,
      });
    });

    socket.on('stopTyping', (data) => {
      socket.to(data.conversationId).emit('typing', {
        conversationId: data.conversationId,
        userId: user.id,
        username: user.username,
      });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${user.username}`);
      onlineUsers.delete(user.id);
      io.emit('userOffline', { userId: user.id });
    });
  });
}
