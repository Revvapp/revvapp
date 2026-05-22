import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from '@/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';

export function useUnreadMessageCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'conversations'), where('clientId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const unread = snap.docs.filter((d) => {
        const data = d.data();
        return data.lastSenderId && data.lastSenderId !== user.uid;
      }).length;
      setCount(unread);
    });
    return () => unsub();
  }, [user?.uid]);

  return count;
}
