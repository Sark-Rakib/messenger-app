"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/lib/auth";
import { User } from "@/app/lib/supabase";
import {
  useConversations,
  useMessages,
  useUsers,
  getOrCreateConversation,
  uploadImage,
  uploadProfileImage,
  editMessage,
  deleteMessage,
  Message,
} from "@/app/lib/hooks";
import Image from "next/image";

export default function ChatPage() {
  const { user, logout, loading: authLoading, updateUser } = useAuth();
  const router = useRouter();

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const getInitialConversationId = () => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem("lastConversationId");
  };

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [showUserList, setShowUserList] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [sendingImage, setSendingImage] = useState(false);
  const [showProfileSettings, setShowProfileSettings] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [newUsername, setNewUsername] = useState(user?.username || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(
    null,
  );
  const [showMobileMenu, setShowMobileMenu] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { messages, sendMessage, setMessages } = useMessages(conversationId);
  const { conversations } = useConversations();
  const { users } = useUsers();

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth/login");
    }
    if (user) {
      setNewUsername(user.username);
      const savedConvId = sessionStorage.getItem("lastConversationId");
      if (savedConvId) {
        setConversationId(savedConvId);
      }
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (conversationId && conversations.length > 0) {
      const conv = conversations.find((c: any) => c.id === conversationId);
      if (conv?.user_data) {
        setSelectedUser(conv.user_data);
        setShowMobileChat(true);
      }
    }
  }, [conversationId, conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelectUser = async (chatUser: User) => {
    if (!user) return;
    setSelectedUser(chatUser);
    const convId = await getOrCreateConversation(user.id, chatUser.id);
    setConversationId(convId);
    setShowUserList(false);
    setShowMobileChat(true);
    sessionStorage.setItem("lastConversationId", convId);
    sessionStorage.setItem("lastUserId", chatUser.id);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !conversationId) return;
    sendMessage(messageText.trim());
    setMessageText("");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversationId) return;

    setSendingImage(true);
    try {
      const imageUrl = await uploadImage(file);
      sendMessage("", imageUrl);
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setSendingImage(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/auth/login");
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const updates: { username: string; avatar_url?: string } = {
        username: newUsername,
      };
      if (profileImage) {
        updates.avatar_url = await uploadProfileImage(profileImage, user.id);
      }
      await updateUser(updates);
      setShowProfileSettings(false);
      setProfileImage(null);
    } catch (error) {
      console.error("Failed to update profile:", error);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleEditMessage = async (messageId: string) => {
    try {
      await editMessage(messageId, editText);
      setEditingMessageId(null);
      setEditText("");
    } catch (error) {
      console.error("Edit message error:", error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      if (confirm("Delete this message?")) {
        setMessages((prev: any) => prev.filter((m: any) => m.id !== messageId));
        await deleteMessage(messageId);
      }
    } catch (error) {
      console.error("Delete message error:", error);
    }
  };

  const startEditMessage = (msg: Message) => {
    if (!msg.text) return;
    setEditingMessageId(msg.id);
    setEditText(msg.text || "");
  };

  const handleLongPress = (msg: Message, e: React.TouchEvent) => {
    e.preventDefault();
    setShowMobileMenu(msg.id);
  };

  const handleTouchStart = (msg: Message, e: React.TouchEvent) => {
    const timer = setTimeout(() => {
      handleLongPress(msg, e);
    }, 500);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const closeMobileMenu = () => {
    setShowMobileMenu(null);
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div
        className={`w-full md:w-96 bg-white border-r flex flex-col ${
          showMobileChat ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-800">Messages</h1>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-red-500 transition"
            >
              Logout
            </button>
          </div>
          <button
            onClick={() => setShowUserList(true)}
            className="w-full py-3 px-4 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition flex items-center justify-center gap-2"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Message
          </button>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <p>No conversations yet</p>
              <p className="text-sm mt-1">Click New Message to start</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() =>
                  conv.user_data && handleSelectUser(conv.user_data)
                }
                className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 border-b transition ${
                  selectedUser?.id === conv.user_data?.id ? "bg-blue-50" : ""
                }`}
              >
                <div className="relative">
                  {conv.user_data?.avatar_url ? (
                    <Image
                      src={conv.user_data.avatar_url}
                      alt={conv.user_data.username}
                      width={56}
                      height={56}
                      className="w-14 h-14 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                      {conv.user_data?.username?.[0]?.toUpperCase()}
                    </div>
                  )}
                  {conv.user_data?.is_online && (
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white"></div>
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-800 truncate">
                      {conv.user_data?.username || "Unknown"}
                    </span>
                    {conv.last_message_at && (
                      <span className="text-xs text-gray-400">
                        {formatTime(conv.last_message_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    {conv.last_message?.text || "No messages yet"}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Current User */}
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-linear-to-br from-green-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg overflow-hidden">
              {user.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt={user.username}
                  width={48}
                  height={48}
                  className="w-full h-full object-cover"
                  unoptimized
                />
              ) : (
                user.username?.[0]?.toUpperCase()
              )}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-gray-800">{user.username}</div>
              <div className="text-xs text-green-500 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                Online
              </div>
            </div>
            <button
              onClick={() => setShowProfileSettings(true)}
              className="p-2 hover:bg-gray-200 rounded-full transition"
            >
              <svg
                className="w-5 h-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* User List Modal */}
      {showUserList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white w-full max-w-lg mx-4 rounded-2xl overflow-hidden">
            <div className="p-4 border-b">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">New Message</h2>
                <button
                  onClick={() => setShowUserList(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users..."
                className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="max-h-96 overflow-y-auto p-4">
              {filteredUsers.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No users found</p>
              ) : (
                filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleSelectUser(u)}
                    className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 rounded-xl transition mb-2"
                  >
                    <div className="relative">
                      {u.avatar_url ? (
                        <Image
                          src={u.avatar_url}
                          alt={u.username}
                          width={48}
                          height={48}
                          className="w-12 h-12 rounded-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                          {u.username?.[0]?.toUpperCase()}
                        </div>
                      )}
                      {u.is_online && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                    <div className="text-left">
                      <div className="font-semibold">{u.username}</div>
                      <div className="text-sm text-gray-500">{u.email}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile Settings Modal */}
      {showProfileSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white w-full max-w-md mx-4 rounded-2xl overflow-hidden p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">Edit Profile</h2>
              <button
                onClick={() => setShowProfileSettings(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-3xl overflow-hidden mb-3">
                  {user.avatar_url ? (
                    <Image
                      src={user.avatar_url}
                      alt={user.username}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    newUsername?.[0]?.toUpperCase()
                  )}
                </div>
                <label className="cursor-pointer text-blue-500 hover:text-blue-600 text-sm font-medium">
                  Change Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      setProfileImage(e.target.files?.[0] || null)
                    }
                  />
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="w-full py-3 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 disabled:opacity-50 transition"
              >
                {savingProfile ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Area */}
      <div
        className={`flex-1 flex flex-col ${!showMobileChat ? "hidden md:flex" : "flex"}`}
      >
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="p-3 border-b bg-white flex items-center gap-3">
              <button
                onClick={() => setShowMobileChat(false)}
                className="md:hidden text-gray-500 text-2xl"
              >
                ←
              </button>
              <div className="relative">
                {selectedUser.avatar_url ? (
                  <Image
                    src={selectedUser.avatar_url}
                    alt={selectedUser.username}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-full object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                    {selectedUser.username?.[0]?.toUpperCase()}
                  </div>
                )}
                {selectedUser.is_online && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                )}
              </div>
              <div>
                <div className="font-semibold">{selectedUser.username}</div>
                <div className="text-xs text-gray-500">
                  {selectedUser.is_online ? "Online" : "Offline"}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
              {messages.map((msg) => {
                const isMe = msg.sender_id === user.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMe ? "justify-end" : "justify-start"} group relative`}
                    onTouchStart={(e) => isMe && handleTouchStart(msg, e)}
                    onTouchEnd={handleTouchEnd}
                    onTouchCancel={handleTouchEnd}
                  >
                    {editingMessageId === msg.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="px-4 py-2 border rounded-full focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <button
                          onClick={() => handleEditMessage(msg.id)}
                          className="px-3 py-2 bg-blue-500 text-white rounded-full text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingMessageId(null)}
                          className="px-3 py-2 bg-gray-300 rounded-full text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="relative group">
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                            isMe
                              ? "bg-blue-500 text-white rounded-br-md"
                              : "bg-white text-gray-800 rounded-bl-md shadow"
                          }`}
                        >
                          {msg.image_url && (
                            <Image
                              src={msg.image_url}
                              alt="Image"
                              width={400}
                              height={400}
                              className="rounded-lg w-full h-auto"
                              unoptimized
                            />
                          )}
                          {msg.text && (
                            <p className="break-words">{msg.text}</p>
                          )}
                          <div
                            className={`text-xs mt-1 ${isMe ? "text-blue-100" : "text-gray-400"}`}
                          >
                            {formatTime(msg.created_at)}
                            {msg.edited && " (edited)"}
                          </div>
                        </div>
                        {isMe && (
                          <div
                            className={`absolute ${isMe ? "-left-15" : "-right-12"} top-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex`}
                          >
                            {msg.text && (
                              <button
                                onClick={() => startEditMessage(msg)}
                                className="p-1 hover:bg-gray-200 rounded"
                                title="Edit"
                              >
                                <svg
                                  className="w-4 h-4 text-gray-500"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="p-1 hover:bg-gray-200 rounded"
                              title="Delete"
                            >
                              <svg
                                className="w-4 h-4 text-red-500"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1H6a1 1 0 00-1 1v3M7 7h10"
                                />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Mobile Long Press Menu */}
            {showMobileMenu &&
              (() => {
                const msg = messages.find((m) => m.id === showMobileMenu);
                return (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
                    onClick={closeMobileMenu}
                  >
                    <div
                      className="bg-white rounded-xl p-4 flex gap-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {msg?.text && (
                        <button
                          onClick={() => {
                            if (msg) startEditMessage(msg);
                            closeMobileMenu();
                          }}
                          className="px-4 py-2 bg-blue-500 text-white rounded-lg"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setMessages((prev: any) =>
                            prev.filter((m: any) => m.id !== showMobileMenu),
                          );
                          deleteMessage(showMobileMenu);
                          closeMobileMenu();
                        }}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg"
                      >
                        Delete
                      </button>
                      <button
                        onClick={closeMobileMenu}
                        className="px-4 py-2 bg-gray-300 rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              })()}

            {/* Message Input */}
            <form
              onSubmit={handleSendMessage}
              className="px-2 py-3 border-t bg-white"
            >
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sendingImage}
                  className="p-3 hover:bg-gray-100 rounded-full transition"
                >
                  {sendingImage ? (
                    <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                  ) : (
                    <svg
                      className="w-6 h-6 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  )}
                </button>
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-3 border rounded-full focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button
                  type="submit"
                  disabled={!messageText.trim()}
                  className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50 transition"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                    />
                  </svg>
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-200 flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">
                Welcome to Chatify
              </h2>
              <p className="text-gray-500">
                Select a conversation or start a new message
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
