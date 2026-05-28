import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import { db } from '@/firebaseConfig';

type Stamp = { toMillis?: () => number } | null | undefined;

export type ConversationReadState = {
  lastSenderId?: string;
  lastMessageAt?: Stamp;
  reads?: Record<string, Stamp>;
};

/**
 * A conversation is unread for `uid` when the last message was sent by the
 * other party AND it arrived after this user last opened the thread.
 */
export function isConversationUnread(data: ConversationReadState, uid: string): boolean {
  const lastSenderId = data.lastSenderId;
  if (!lastSenderId || lastSenderId === uid) return false;
  const lastAt = data.lastMessageAt?.toMillis?.() ?? 0;
  const readAt = data.reads?.[uid]?.toMillis?.() ?? 0;
  return readAt < lastAt;
}

/** Stamp the current user's read time on a conversation. Best-effort. */
export async function markConversationRead(conversationId: string, uid: string): Promise<void> {
  if (!conversationId || !uid) return;
  try {
    await setDoc(
      doc(db, 'conversations', conversationId),
      { reads: { [uid]: serverTimestamp() } },
      { merge: true }
    );
  } catch {
    // Best-effort — never block the UI on read receipts.
  }
}
