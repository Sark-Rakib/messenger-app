import { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
  username: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export interface ServerToClientEvents {
  message: (message: MessagePayload) => void;
  typing: (data: { conversationId: string; userId: string; username: string }) => void;
  userOnline: (data: { userId: string }) => void;
  userOffline: (data: { userId: string }) => void;
  conversationUpdate: (conversation: unknown) => void;
}

export interface ClientToServerEvents {
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  sendMessage: (data: SendMessagePayload) => void;
  typing: (data: { conversationId: string }) => void;
  stopTyping: (data: { conversationId: string }) => void;
}

export interface SendMessagePayload {
  conversationId: string;
  content?: string;
  attachmentUrl?: string;
  attachmentType?: 'IMAGE' | 'FILE';
}

export interface MessagePayload {
  id: string;
  conversationId: string;
  senderId: string;
  sender: {
    id: string;
    username: string;
    avatar: string | null;
  };
  content: string | null;
  attachmentUrl: string | null;
  attachmentType: 'IMAGE' | 'FILE' | null;
  createdAt: Date;
}
