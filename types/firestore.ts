import type { Timestamp } from 'firebase/firestore';

export type UserType = 'detailer' | 'client';

export type UserDocument = {
  uid: string;
  email: string | null;
  userType: UserType;
  createdAt: Timestamp | null;
  onboardingComplete: boolean;
  isFoundingPro?: boolean;
  subscriptionStatus?: string;
  trialDays?: number;
  trialStartDate?: Timestamp | null;
};

export type DetailerDocument = {
  uid: string;
  fullName: string;
  businessName?: string;
  phone: string;
  city: string;
  state: string;
  bio: string;
  services: string[];
  rates: Record<string, string>;
  workingDays: number[];
  workingHours: { from: string; to: string };
  serviceArea: string;
  maxJobsPerDay: number;
  profilePhotoUrl: string;
  portfolioUrls: string[];
  idVerified: boolean;
  incomeGoal: { daily: number; weekly: number };
  rating: number;
  reviewCount: number;
  lat?: number;
  lng?: number;
  isFoundingPro?: boolean;
  isActive: boolean;
  profileComplete: boolean;
};

export type ClientDocument = {
  uid: string;
  email: string | null;
  fullName?: string;
  phone?: string;
  city?: string;
  state?: string;
  createdAt?: Timestamp | null;
};

export type VehicleDocument = {
  id: string;
  make: string;
  model: string;
  year: number;
  color?: string;
  lastDetailedDate: string | null;
  ownerId: string;
};

export type BookingDocument = {
  id: string;
  clientId: string;
  detailerId: string;
  service: string;
  price: number;
  status: string;
  date: string;
  time: string;
  vehicleId: string;
  clientName?: string;
  detailerName?: string;
  vehicleLabel?: string;
  address?: string;
  notes?: string;
  virSubmittedAt?: Timestamp | null;
  virSignedAt?: Timestamp | null;
  jobStartedAt?: Timestamp | null;
  virPanels?: Record<string, { photoUrl: string; notes: string }>;
  createdAt: Timestamp | null;
};
