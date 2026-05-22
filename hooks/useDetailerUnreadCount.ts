import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from '@/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';

export function useDetailerUnreadCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'conversations'), where('detailerId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setCount(
        snap.docs.filter((d) => {
          const data = d.data();
          return data.lastSenderId && data.lastSenderId !== user.uid;
        }).length
      );
    });
    return () => unsub();
  }, [user?.uid]);

  return count;
}
