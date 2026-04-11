'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/app/lib/auth';
import { useConversations, useMessages, useSearchUsers, uploadFile } from '@/app/lib/messages';

interface SearchUser {
  uid: string;
  username: string;
  email: string;
}

export default function ChatPage() {
  const { user, logout } = useAuth();
  const { conversations, createDirectConversation, createGroupConversation } = useConversations();
  const { searchResults, search } = useSearchUsers();
  
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const { messages, sendMessage } = useMessages(selectedConversationId);
  
  const [newMessage, setNewMessage] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<SearchUser[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (showNewChat && searchQuery) {
      const timeout = setTimeout(() => search(searchQuery), 300);
      return () => clearTimeout(timeout);
    }
  }, [searchQuery, showNewChat, search]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversationId) return;
    await sendMessage(newMessage.trim());
    setNewMessage('');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConversationId) return;
    const { url, type } = await uploadFile(file);
    await sendMessage('', { url, type });
  };

  const startDirectChat = async (otherUser: SearchUser) => {
    const convId = await createDirectConversation(otherUser.uid, otherUser.username);
    if (convId) {
      setSelectedConversationId(convId);
    }
    setShowNewChat(false);
    setSearchQuery('');
  };

  const handleCreateGroup = async () => {
    if (selectedUsers.length < 2 || !groupName.trim()) return;
    const convId = await createGroupConversation(
      groupName,
      selectedUsers.map(u => u.uid)
    );
    if (convId) {
      setSelectedConversationId(convId);
    }
    setShowGroupModal(false);
    setGroupName('');
    setSelectedUsers([]);
  };

  const getConversationName = (conv: typeof conversations[0]) => {
    if (conv.type === 'GROUP') return conv.name;
    const otherId = conv.participants.find(p => p !== user?.uid);
    if (!otherId) return 'Unknown';
    return conv.participantNames?.[otherId] || 'Unknown';
  };

  const selectedConv = conversations.find(c => c.id === selectedConversationId);

  return (
    <div className="flex h-screen bg-gray-100">
      <aside className="w-80 bg-white border-r flex flex-col">
        <header className="p-4 border-b flex items-center justify-between">
          <h1 className="font-bold text-lg">Messages</h1>
          <div className="flex gap-2">
            <button onClick={() => setShowNewChat(true)} className="p-2 hover:bg-gray-100 rounded" title="New Chat">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button onClick={() => setShowGroupModal(true)} className="p-2 hover:bg-gray-100 rounded" title="New Group">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setSelectedConversationId(conv.id)}
              className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 ${selectedConversationId === conv.id ? 'bg-blue-50' : ''}`}
            >
              <div className="w-12 h-12 rounded-full bg-gray-300 flex items-center justify-center text-lg font-semibold">
                {getConversationName(conv)?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold">{getConversationName(conv)}</div>
                {conv.lastMessage && (
                  <div className="text-sm text-gray-500 truncate">
                    {conv.lastMessage.content || (conv.lastMessage.attachmentType === 'IMAGE' ? '📷 Image' : '📎 File')}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
        <footer className="p-4 border-t flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
            {user?.username[0].toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="font-semibold">{user?.username}</div>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-red-500">Sign out</button>
          </div>
        </footer>
      </aside>

      <main className="flex-1 flex flex-col">
        {selectedConversationId ? (
          <>
            <header className="p-4 border-b bg-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-lg font-semibold">
                {selectedConv?.name?.[0]?.toUpperCase() || selectedConv?.participantNames?.[selectedConv?.participants.find(p => p !== user?.uid) || '']?.[0]?.toUpperCase()}
              </div>
              <div>
                <div className="font-semibold">
                  {selectedConv?.type === 'GROUP' ? selectedConv?.name : selectedConv?.participantNames?.[selectedConv?.participants.find(p => p !== user?.uid) || '']}
                </div>
                <div className="text-sm text-gray-500">{selectedConv?.participants.length} members</div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.senderId === user?.uid ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${msg.senderId === user?.uid ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-900'}`}>
                    {msg.attachmentType === 'IMAGE' && msg.attachmentUrl && (
                      <img src={msg.attachmentUrl} alt="attachment" className="rounded mb-2 max-w-full" />
                    )}
                    {msg.attachmentType === 'FILE' && msg.attachmentUrl && (
                      <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 mb-2 underline">
                        📎 File attachment
                      </a>
                    )}
                    {msg.content && <p>{msg.content}</p>}
                    <div className={`text-xs mt-1 ${msg.senderId === user?.uid ? 'text-blue-100' : 'text-gray-400'}`}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="p-4 border-t bg-white flex gap-2">
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
              <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-gray-100 rounded">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button type="submit" disabled={!newMessage.trim()} className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50">
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
                <button key={u.uid} onClick={() => startDirectChat(u)} className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                    {u.username[0].toUpperCase()}
                  </div>
                  <span className="font-semibold">{u.username}</span>
                </button>
              ))}
            </div>
            <button onClick={() => { setShowNewChat(false); setSearchQuery(''); }} className="mt-4 w-full py-2 border rounded-lg hover:bg-gray-50">
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
              {searchResults.filter(u => !selectedUsers.find(s => s.uid === u.uid)).map((u) => (
                <button key={u.uid} onClick={() => setSelectedUsers(prev => [...prev, u])} className="w-full p-2 flex items-center gap-2 hover:bg-gray-50 rounded">
                  + {u.username}
                </button>
              ))}
            </div>
            {selectedUsers.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedUsers.map((u) => (
                  <span key={u.uid} className="px-2 py-1 bg-blue-100 rounded-full text-sm flex items-center gap-1">
                    {u.username}
                    <button onClick={() => setSelectedUsers(prev => prev.filter(s => s.uid !== u.uid))}>×</button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button onClick={handleCreateGroup} disabled={selectedUsers.length < 2 || !groupName.trim()} className="flex-1 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">
                Create
              </button>
              <button onClick={() => { setShowGroupModal(false); setGroupName(''); setSelectedUsers([]); setSearchQuery(''); }} className="flex-1 py-2 border rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
