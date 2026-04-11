'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/app/lib/auth';
import { useSocket } from '@/app/lib/socket';

interface User {
  id: string;
  username: string;
  avatar: string | null;
}

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

interface Conversation {
  id: string;
  type: 'DIRECT' | 'GROUP';
  name: string | null;
  avatar: string | null;
  participants: User[];
  lastMessage: Message | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function ChatPage() {
  const { user, logout } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState<Record<string, { userId: string; username: string }>>({});
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleMessage = useCallback((message: Message) => {
    setMessages((prev) => [...prev, message]);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === message.conversationId ? { ...c, lastMessage: message } : c
      )
    );
  }, []);

  const handleTyping = useCallback((data: { conversationId: string; userId: string; username: string }) => {
    setTypingUsers((prev) => ({ ...prev, [data.userId]: data }));
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setTypingUsers((prev) => {
        const { [data.userId]: _, ...rest } = prev;
        return rest;
      });
    }, 3000);
  }, []);

  const { joinConversation, leaveConversation, sendMessage, typing, stopTyping } = useSocket({
    onMessage: handleMessage,
    onTyping: handleTyping,
  });

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      joinConversation(selectedConversation.id);
      fetchMessages(selectedConversation.id);
      return () => leaveConversation(selectedConversation.id);
    }
  }, [selectedConversation, joinConversation, leaveConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getToken = () => localStorage.getItem('token') || '';

  const fetchConversations = async () => {
    const res = await fetch(`${API_URL}/api/conversations`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    setConversations(data);
  };

  const fetchMessages = async (conversationId: string) => {
    const res = await fetch(`${API_URL}/api/messages/${conversationId}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    setMessages(data);
  };

  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    const res = await fetch(`${API_URL}/api/messages/users/search?q=${query}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    const data = await res.json();
    setSearchResults(data);
  };

  useEffect(() => {
    if (showNewChat && searchQuery) {
      const timeout = setTimeout(() => searchUsers(searchQuery), 300);
      return () => clearTimeout(timeout);
    }
  }, [searchQuery, showNewChat]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    sendMessage({
      conversationId: selectedConversation.id,
      content: newMessage.trim(),
    });
    stopTyping(selectedConversation.id);
    setNewMessage('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (selectedConversation) {
      typing(selectedConversation.id);
    }
  };

  const startDirectChat = async (otherUser: User) => {
    const res = await fetch(`${API_URL}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ participantIds: [otherUser.id] }),
    });
    const conversation = await res.json();
    setConversations((prev) => [conversation, ...prev]);
    setSelectedConversation(conversation);
    setShowNewChat(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  const createGroup = async () => {
    if (selectedUsers.length < 2 || !groupName.trim()) return;
    const res = await fetch(`${API_URL}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        participantIds: selectedUsers.map((u) => u.id),
        type: 'GROUP',
        name: groupName,
      }),
    });
    const conversation = await res.json();
    setConversations((prev) => [conversation, ...prev]);
    setSelectedConversation(conversation);
    setShowGroupModal(false);
    setGroupName('');
    setSelectedUsers([]);
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_URL}/api/messages/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    });
    return res.json();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConversation) return;
    const { url, type } = await uploadFile(file);
    sendMessage({
      conversationId: selectedConversation.id,
      attachmentUrl: url,
      attachmentType: type,
    });
  };

  const getOtherParticipants = (conv: Conversation) => {
    return conv.participants.filter((p) => p.id !== user?.id);
  };

  const typingUsersList = Object.values(typingUsers).filter((u) => u.userId !== user?.id);

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-80 bg-white border-r flex flex-col">
        <header className="p-4 border-b flex items-center justify-between">
          <h1 className="font-bold text-lg">Messages</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setShowNewChat(true)}
              className="p-2 hover:bg-gray-100 rounded"
              title="New Chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={() => setShowGroupModal(true)}
              className="p-2 hover:bg-gray-100 rounded"
              title="New Group"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => {
            const others = getOtherParticipants(conv);
            const displayName = conv.type === 'GROUP' ? conv.name : others[0]?.username;
            return (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 ${
                  selectedConversation?.id === conv.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-lg font-semibold">
                  {displayName?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold">{displayName}</div>
                  {conv.lastMessage && (
                    <div className="text-sm text-gray-500 truncate">
                      {conv.lastMessage.sender.username}: {conv.lastMessage.content || (conv.lastMessage.attachmentType === 'IMAGE' ? '📷 Image' : '📎 File')}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <footer className="p-4 border-t flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
            {user?.username[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="font-semibold">{user?.username}</div>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-red-500">
              Sign out
            </button>
          </div>
        </footer>
      </aside>

      <main className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            <header className="p-4 border-b bg-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-lg font-semibold">
                {(selectedConversation.type === 'GROUP' ? selectedConversation.name : getOtherParticipants(selectedConversation)[0]?.username)?.[0]?.toUpperCase()}
              </div>
              <div>
                <div className="font-semibold">
                  {selectedConversation.type === 'GROUP'
                    ? selectedConversation.name
                    : getOtherParticipants(selectedConversation)[0]?.username}
                </div>
                <div className="text-sm text-gray-500">
                  {selectedConversation.participants.length} members
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      msg.senderId === user?.id
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-900'
                    }`}
                  >
                    {msg.attachmentType === 'IMAGE' && msg.attachmentUrl && (
                      <img
                        src={`${API_URL}${msg.attachmentUrl}`}
                        alt="attachment"
                        className="rounded mb-2 max-w-full"
                      />
                    )}
                    {msg.attachmentType === 'FILE' && msg.attachmentUrl && (
                      <a
                        href={`${API_URL}${msg.attachmentUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 mb-2 underline"
                      >
                        📎 File attachment
                      </a>
                    )}
                    {msg.content && <p>{msg.content}</p>}
                    <div className={`text-xs mt-1 ${msg.senderId === user?.id ? 'text-blue-100' : 'text-gray-400'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              {typingUsersList.length > 0 && (
                <div className="text-sm text-gray-500 italic">
                  {typingUsersList.map((u) => u.username).join(', ')} typing...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="p-4 border-t bg-white flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 hover:bg-gray-100 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={handleInputChange}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Select a conversation to start chatting
          </div>
        )}
      </main>

      {showNewChat && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-4">
            <h2 className="text-lg font-semibold mb-4">New Message</h2>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="w-full px-3 py-2 border rounded-lg mb-4"
            />
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => startDirectChat(u)}
                  className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 rounded-lg"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                    {u.username[0].toUpperCase()}
                  </div>
                  <span className="font-semibold">{u.username}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => { setShowNewChat(false); setSearchQuery(''); setSearchResults([]); }}
              className="mt-4 w-full py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md p-4">
            <h2 className="text-lg font-semibold mb-4">Create Group</h2>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name"
              className="w-full px-3 py-2 border rounded-lg mb-4"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users to add..."
              className="w-full px-3 py-2 border rounded-lg mb-2"
            />
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {searchResults
                .filter((u) => !selectedUsers.find((s) => s.id === u.id))
                .map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUsers((prev) => [...prev, u])}
                    className="w-full p-2 flex items-center gap-2 hover:bg-gray-50 rounded"
                  >
                    + {u.username}
                  </button>
                ))}
            </div>
            {selectedUsers.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedUsers.map((u) => (
                  <span key={u.id} className="px-2 py-1 bg-blue-100 rounded-full text-sm flex items-center gap-1">
                    {u.username}
                    <button onClick={() => setSelectedUsers((prev) => prev.filter((s) => s.id !== u.id))}>×</button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={createGroup}
                disabled={selectedUsers.length < 2 || !groupName.trim()}
                className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                Create
              </button>
              <button
                onClick={() => { setShowGroupModal(false); setGroupName(''); setSelectedUsers([]); setSearchQuery(''); }}
                className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
