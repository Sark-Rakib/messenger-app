'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  collection, addDoc, query, orderBy, onSnapshot, 
  where, getDocs, serverTimestamp,
  QuerySnapshot, DocumentData
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { useAuth } from './auth';

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  content: string | null;
  attachmentUrl: string | null;
  attachmentType: 'IMAGE' | 'FILE' | null;
  createdAt: Date;
}

interface Conversation {
  id: string;
  type: 'DIRECT' | 'GROUP';
  name: string | null;
  participants: string[];
  participantNames?: Record<string, string>;
  lastMessage: Message | null;
  createdAt: Date;
}

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'messages'),
      where('conversationId', '==', conversationId),
      orderBy('createdAt', 'asc')
    );

    const unsub = onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
      const msgs = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate() || new Date(),
      })) as Message[];
      setMessages(msgs);
      setLoading(false);
    });

    return () => unsub();
  }, [conversationId]);

  const sendMessage = useCallback(async (content: string, attachment?: { url: string; type: 'IMAGE' | 'FILE' }) => {
    if (!conversationId) return;
    await addDoc(collection(db, 'messages'), {
      conversationId,
      senderId: 'currentUser',
      senderName: 'User',
      content: content || null,
      attachmentUrl: attachment?.url || null,
      attachmentType: attachment?.type || null,
      createdAt: serverTimestamp(),
    });
  }, [conversationId]);

  return { messages, loading, sendMessage };
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

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', user.uid)
    );

    const unsub = onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
      const convs = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate() || new Date(),
      })) as Conversation[];
      setConversations(convs);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  const createDirectConversation = useCallback(async (otherUserId: string, otherUsername: string) => {
    if (!user) return null;

    const q = query(
      collection(db, 'conversations'),
      where('type', '==', 'DIRECT'),
      where('participants', 'array-contains', user.uid)
    );
    const snapshot = await getDocs(q);
    
    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      if (data.participants.includes(otherUserId)) {
        return docSnap.id;
      }
    }

    const docRef = await addDoc(collection(db, 'conversations'), {
      type: 'DIRECT',
      name: null,
      participants: [user.uid, otherUserId],
      participantNames: { [user.uid]: user.username, [otherUserId]: otherUsername },
      lastMessage: null,
      createdAt: serverTimestamp(),
    });

    return docRef.id;
  }, [user]);

  const createGroupConversation = useCallback(async (name: string, participantIds: string[]) => {
    if (!user) return null;

    const docRef = await addDoc(collection(db, 'conversations'), {
      type: 'GROUP',
      name,
      participants: [user.uid, ...participantIds],
      lastMessage: null,
      createdAt: serverTimestamp(),
    });

    return docRef.id;
  }, [user]);

  return { conversations, loading, createDirectConversation, createGroupConversation };
}

export function useSearchUsers() {
  const [searchResults, setSearchResults] = useState<{ uid: string; username: string; email: string }[]>([]);

  const search = useCallback(async (queryText: string) => {
    if (queryText.length < 2) {
      setSearchResults([]);
      return;
    }

    const q = query(collection(db, 'users'));
    const snapshot = await getDocs(q);
    const results = snapshot.docs
      .map(d => ({ uid: d.id, ...d.data() } as { uid: string; username: string; email: string }))
      .filter(u => 
        u.username.toLowerCase().includes(queryText.toLowerCase()) ||
        u.email.toLowerCase().includes(queryText.toLowerCase())
      )
      .slice(0, 10);

    setSearchResults(results);
  }, []);

  return { searchResults, search };
}

export async function uploadFile(file: File): Promise<{ url: string; type: 'IMAGE' | 'FILE' }> {
  const isImage = file.type.startsWith('image/');
  const path = `attachments/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  
  return { url, type: isImage ? 'IMAGE' : 'FILE' };
}
