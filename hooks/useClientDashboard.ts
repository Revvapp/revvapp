import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';

import { db } from '@/firebaseConfig';
import { useAuth } from '@/hooks/useAuth';
import { toTitleCase } from '@/lib/format';
import type { BookingDocument, VehicleDocument } from '@/types/firestore';

export type ClientDashboardModel = {
  loading: boolean;
  displayName: string;
  initials: string;
  cityLine: string;
  vehicles: VehicleDocument[];
  activeBookings: BookingDocument[];
  error: string | null;
  refetch: () => Promise<void>;
};

function initialsFrom(name: string, email: string | null | undefined) {
  const n = name.trim();
  if (n.length >= 2) {
    const p = n.split(/\s+/);
    if (p.length >= 2) return `${p[0][0] ?? ''}${p[1][0] ?? ''}`.toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  if (email && email.length >= 2) return email.slice(0, 2).toUpperCase();
  return 'RV';
}

export function useClientDashboard(): ClientDashboardModel {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<Omit<ClientDashboardModel, 'loading' | 'error' | 'refetch'>>({
    displayName: '',
    initials: 'RV',
    cityLine: '',
    vehicles: [],
    activeBookings: [],
  });

  const load = useCallback(async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [clientSnap, bookingsSnap, vehiclesSnap] = await Promise.all([
        getDoc(doc(db, 'clients', user.uid)),
        getDocs(query(collection(db, 'bookings'), where('clientId', '==', user.uid))),
        getDocs(collection(db, 'clients', user.uid, 'vehicles')),
      ]);

      const clientData = clientSnap.exists() ? clientSnap.data() : null;
      const fullName = String(clientData?.fullName ?? '');
      const city = clientData?.city ? String(clientData.city) : '';
      const state = clientData?.state ? String(clientData.state) : '';

      const vehicles: VehicleDocument[] = vehiclesSnap.docs.map((d) => {
        const v = d.data();
        return {
          id: d.id,
          make: String(v.make ?? ''),
          model: String(v.model ?? ''),
          year: Number(v.year ?? 0),
          color: v.color ? String(v.color) : undefined,
          lastDetailedDate: v.lastDetailedDate != null ? String(v.lastDetailedDate) : null,
          ownerId: user.uid,
        };
      });

      const bookingsRaw = bookingsSnap.docs.map((d) => {
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
          createdAt: x.createdAt ?? null,
        } satisfies BookingDocument;
      });

      const activeBookings = bookingsRaw.filter((b) => b.status === 'confirmed');

      const displayName = fullName.trim()
        ? toTitleCase(fullName.trim())
        : (user.email ?? 'Client');

      const cityLine = city && state
        ? `${toTitleCase(city)}, ${state.toUpperCase()}`
        : toTitleCase(city) || state.toUpperCase() || '';

      setModel({
        displayName,
        initials: initialsFrom(fullName, user.email),
        cityLine,
        vehicles,
        activeBookings,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your home screen.');
    } finally {
      setLoading(false);
    }
  }, [user?.uid, user?.email]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    loading,
    error,
    refetch: load,
    ...model,
  };
}
