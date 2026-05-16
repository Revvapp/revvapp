import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';

import { db } from '@/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';
import type { BookingDocument } from '@/types/firestore';

export type DetailerJobsModel = {
  loading: boolean;
  error: string | null;
  pending: BookingDocument[];
  active: BookingDocument[];
  completed: BookingDocument[];
  acceptJob: (id: string) => Promise<void>;
  declineJob: (id: string) => Promise<void>;
  completeJob: (id: string) => Promise<void>;
};

function mapDoc(d: import('firebase/firestore').QueryDocumentSnapshot): BookingDocument {
  const x = d.data();
  return {
    id: d.id,
    clientId: String(x.clientId ?? ''),
    detailerId: String(x.detailerId ?? ''),
    service: String(x.service ?? ''),
    price: Number(x.price ?? 0),
    status: String(x.status ?? '').toLowerCase(),
    date: String(x.date ?? ''),
    time: String(x.time ?? ''),
    vehicleId: String(x.vehicleId ?? ''),
    clientName: x.clientName ? String(x.clientName) : undefined,
    vehicleLabel: x.vehicleLabel ? String(x.vehicleLabel) : undefined,
    address: x.address ? String(x.address) : undefined,
    notes: x.notes ? String(x.notes) : undefined,
    createdAt: x.createdAt ?? null,
  };
}

export function useDetailerJobs(): DetailerJobsModel {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<BookingDocument[]>([]);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    const q = query(collection(db, 'bookings'), where('detailerId', '==', user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setBookings(snap.docs.map(mapDoc));
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [user?.uid]);

  const acceptJob = useCallback(
    async (id: string) => {
      await updateDoc(doc(db, 'bookings', id), { status: 'active' });
    },
    []
  );

  const declineJob = useCallback(
    async (id: string) => {
      await updateDoc(doc(db, 'bookings', id), { status: 'declined' });
    },
    []
  );

  const completeJob = useCallback(
    async (id: string) => {
      await updateDoc(doc(db, 'bookings', id), { status: 'completed' });
    },
    []
  );

  const pending = bookings
    .filter((b) => b.status === 'pending')
    .sort((a, b) => a.date.localeCompare(b.date));

  const active = bookings
    .filter((b) => ['active', 'vir_submitted', 'vir_signed', 'in_progress', 'paused'].includes(b.status))
    .sort((a, b) => a.date.localeCompare(b.date));

  const completed = bookings
    .filter((b) => b.status === 'completed')
    .sort((a, b) => b.date.localeCompare(a.date));

  return { loading, error, pending, active, completed, acceptJob, declineJob, completeJob };
}
