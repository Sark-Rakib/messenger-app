"use client";

import { useState, useEffect, useCallback } from "react";
import { User, Message, Conversation } from "./supabase";
import { useAuth } from "./auth";

export type { User, Message, Conversation };

let supabaseInstance: any = null;

async function getSupabase() {
  if (supabaseInstance) return supabaseInstance;

  const { createClient } = await import("@supabase/supabase-js");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase configuration");
  }

  supabaseInstance = createClient(supabaseUrl, supabaseKey);
  return supabaseInstance;
}

export function useConversations() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setConversations([]);
      setLoading(false);
      return;
    }

    let channel: any = null;

    const fetchConversations = async () => {
      try {
        const supabase = await getSupabase();

        const { data, error } = await supabase
          .from("conversations")
          .select(
            `
            *,
            messages(id, text, sender_id, image_url, created_at)
          `,
          )
          .contains("participants", [user.id])
          .order("last_message_at", { ascending: false });

        if (data) {
          const convsWithUsers = await Promise.all(
            data.map(async (conv: any) => {
              const otherUserId = conv.participants.find(
                (p: string) => p !== user.id,
              );
              if (otherUserId) {
                const { data: userData } = await supabase
                  .from("users")
                  .select("*")
                  .eq("id", otherUserId)
                  .single();
                return { ...conv, user_data: userData };
              }
              return conv;
            }),
          );
          setConversations(convsWithUsers);
        }
      } catch (err) {
        console.error("Error fetching conversations:", err);
      }
      setLoading(false);
    };

    fetchConversations();

    const setupRealtime = async () => {
      const supabase = await getSupabase();

      channel = supabase
        .channel("conversations_changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "conversations" },
          () => fetchConversations(),
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channel && supabaseInstance) supabaseInstance.removeChannel(channel);
    };
  }, [user?.id]);

  return { conversations, loading };
}

export function useMessages(conversationId: string | null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    let channel: any = null;

    const fetchMessages = async () => {
      try {
        const supabase = await getSupabase();

        const { data } = await supabase
          .from("messages")
          .select(
            `
            *,
            sender:users(*)
          `,
          )
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true });

        if (data) setMessages(data);
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
      setLoading(false);
    };

    fetchMessages();

    const setupRealtime = async () => {
      const supabase = await getSupabase();

      channel = supabase
        .channel(`messages_${conversationId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `conversation_id=eq.${conversationId}`,
          },
          async (payload: any) => {
            const { data: newMessage } = await supabase
              .from("messages")
              .select(`*, sender:users(*)`)
              .eq("id", payload.new.id)
              .single();

            if (newMessage) {
              setMessages((prev) => [...prev, newMessage]);
            }
          },
        )
        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channel && supabaseInstance) supabaseInstance.removeChannel(channel);
    };
  }, [conversationId]);

  const sendMessage = useCallback(
    async (text: string, imageUrl?: string) => {
      if (!conversationId || !user) return;

      try {
        const supabase = await getSupabase();

        const newMessage = {
          conversation_id: conversationId,
          sender_id: user.id,
          text: text || null,
          image_url: imageUrl || null,
        };

        await supabase.from("messages").insert(newMessage);

        await supabase
          .from("conversations")
          .update({
            last_message_at: new Date().toISOString(),
            last_message: { text: text || "📷 Image" },
          })
          .eq("id", conversationId);
      } catch (err) {
        console.error("Error sending message:", err);
      }
    },
    [conversationId, user],
  );

  return { messages, loading, sendMessage };
}

export function useUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let channel: any = null;

    const fetchUsers = async () => {
      try {
        const supabase = await getSupabase();

        const { data } = await supabase
          .from("users")
          .select("*")
          .neq("id", user?.id || "");

        if (data) setUsers(data);
      } catch (err) {
        console.error("Error fetching users:", err);
      }
      setLoading(false);
    };

    fetchUsers();

    const setupRealtime = async () => {
      const supabase = await getSupabase();

      // optional: cleanup old channel first (IMPORTANT)
      if (channel) {
        await supabase.removeChannel(channel);
      }

      channel = supabase
        .channel("users_changes")

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "users",
          },
          () => {
            fetchUsers();
          },
        )

        .subscribe();
    };

    setupRealtime();

    return () => {
      if (channel && supabaseInstance) supabaseInstance.removeChannel(channel);
    };
  }, [user?.id]);

  return { users, loading };
}

export async function getOrCreateConversation(
  userId: string,
  otherUserId: string,
): Promise<string> {
  const supabase = await getSupabase();

  const { data } = await supabase
    .from("conversations")
    .select("id, participants")
    .contains("participants", [userId]);

  if (data && data.length > 0) {
    for (const conv of data) {
      if (conv.participants.includes(otherUserId)) {
        return conv.id;
      }
    }
  }

  const { data: newConv, error } = await supabase
    .from("conversations")
    .insert({
      participants: [userId, otherUserId],
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;
  return newConv.id;
}

export async function uploadImage(file: File): Promise<string> {
  const supabase = await getSupabase();

  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}.${fileExt}`;
  const filePath = `images/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("message-images")
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from("message-images")
    .getPublicUrl(filePath);

  return data.publicUrl;
}
