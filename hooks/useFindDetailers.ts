import { collection, onSnapshot, query, where } from 'firebase/firestore';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { db } from '@/firebaseConfig';
import type { DetailerDocument } from '@/types/firestore';

export type DetailerWithDistance = DetailerDocument & {
  distanceMi: number | null;
};

export type FindDetailersModel = {
  loading: boolean;
  locationDenied: boolean;
  error: string | null;
  detailers: DetailerWithDistance[];
  clientLat: number | null;
  clientLng: number | null;
};

function haversineMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(mi: number): string {
  return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
}

export function lowestRate(rates: Record<string, string>): string | null {
  const nums = Object.values(rates)
    .map((v) => parseFloat(v.replace(/[^0-9.]/g, '')))
    .filter((n) => !isNaN(n));
  if (nums.length === 0) return null;
  return `$${Math.min(...nums)}`;
}

export function useFindDetailers(): FindDetailersModel {
  const [loading, setLoading] = useState(true);
  const [locationDenied, setLocationDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawDetailers, setRawDetailers] = useState<DetailerDocument[]>([]);
  const [ratings, setRatings] = useState<Record<string, { rating: number; reviewCount: number }>>({});
  const [clientLat, setClientLat] = useState<number | null>(null);
  const [clientLng, setClientLng] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationDenied(true);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setClientLat(pos.coords.latitude);
        setClientLng(pos.coords.longitude);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not get location.');
      }
    })();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'detailers'),
      where('isActive', '==', true),
      where('profileComplete', '==', true)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const docs = snap.docs.map((d) => ({ uid: d.id, ...d.data() } as DetailerDocument));
        setRawDetailers(docs);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Live ratings aggregated from the reviews collection (single source of truth —
  // the stored detailer.rating field is never written by clients).
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'reviews'), (snap) => {
      const acc: Record<string, { sum: number; count: number }> = {};
      snap.docs.forEach((d) => {
        const detailerId = String(d.data().detailerId ?? '');
        const r = Number(d.data().rating ?? 0);
        if (!detailerId || !r) return;
        acc[detailerId] = acc[detailerId]
          ? { sum: acc[detailerId].sum + r, count: acc[detailerId].count + 1 }
          : { sum: r, count: 1 };
      });
      const next: Record<string, { rating: number; reviewCount: number }> = {};
      Object.entries(acc).forEach(([id, { sum, count }]) => {
        next[id] = { rating: sum / count, reviewCount: count };
      });
      setRatings(next);
    });
    return () => unsub();
  }, []);

  const MAX_RADIUS_MI = 50;

  const detailers: DetailerWithDistance[] = rawDetailers
    .map((d) => {
      const distanceMi =
        clientLat != null && clientLng != null && d.lat != null && d.lng != null
          ? haversineMi(clientLat, clientLng, d.lat, d.lng)
          : null;
      const agg = ratings[d.uid];
      return {
        ...d,
        rating: agg ? agg.rating : 0,
        reviewCount: agg ? agg.reviewCount : 0,
        distanceMi,
      };
    })
    .filter((d) => d.distanceMi == null || d.distanceMi <= MAX_RADIUS_MI)
    .sort((a, b) => {
      if (a.distanceMi == null && b.distanceMi == null) return 0;
      if (a.distanceMi == null) return 1;
      if (b.distanceMi == null) return -1;
      return a.distanceMi - b.distanceMi;
    });

  return { loading, locationDenied, error, detailers, clientLat, clientLng };
}
