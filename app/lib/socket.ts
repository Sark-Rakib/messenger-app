'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './auth';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender: { id: string; username: string; avatar: string | null };
  content: string | null;
  attachmentUrl: string | null;
  attachmentType: 'IMAGE' | 'FILE' | null;
  createdAt: Date;
}

interface UseSocketOptions {
  onMessage?: (message: Message) => void;
  onTyping?: (data: { conversationId: string; userId: string; username: string }) => void;
}

export function useSocket({ onMessage, onTyping }: UseSocketOptions = {}) {
  const { token } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const socket = io(process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3001', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('message', (message: Message) => onMessage?.(message));
    socket.on('typing', (data) => onTyping?.(data));

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [token, onMessage, onTyping]);

  const joinConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('joinConversation', conversationId);
  }, []);

  const leaveConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('leaveConversation', conversationId);
  }, []);

  const sendMessage = useCallback((data: { conversationId: string; content?: string; attachmentUrl?: string; attachmentType?: 'IMAGE' | 'FILE' }) => {
    socketRef.current?.emit('sendMessage', data);
  }, []);

  const typing = useCallback((conversationId: string) => {
    socketRef.current?.emit('typing', { conversationId });
  }, []);

  const stopTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('stopTyping', { conversationId });
  }, []);

  return { isConnected, joinConversation, leaveConversation, sendMessage, typing, stopTyping };
}
