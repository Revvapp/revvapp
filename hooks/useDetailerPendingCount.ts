import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from '@/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';

export function useDetailerPendingCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'bookings'),
      where('detailerId', '==', user.uid),
      where('status', '==', 'pending')
    );
    const unsub = onSnapshot(q, (snap) => setCount(snap.size));
    return () => unsub();
  }, [user?.uid]);

  return count;
}
