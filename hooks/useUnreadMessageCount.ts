import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from '@/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';
import { isConversationUnread } from '@/lib/conversations';

export function useUnreadMessageCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    const uid = user.uid;
    const q = query(collection(db, 'conversations'), where('clientId', '==', uid));
    const unsub = onSnapshot(q, (snap) => {
      setCount(snap.docs.filter((d) => isConversationUnread(d.data(), uid)).length);
    });
    return () => unsub();
  }, [user?.uid]);

  return count;
}
