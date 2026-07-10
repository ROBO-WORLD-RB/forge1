export enum UserRole {
  WORKER = 'worker',
  CUSTOMER = 'customer',
  ADMIN = 'admin'
}

export enum WorkerTier {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium'
}

export interface User {
  id: string;
  phone: string;
  email?: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  username?: string;
  bio?: string;
  location?: string;
  country?: 'GH' | 'NG';
  profileCompleted: boolean;
  workerStatus?: string;
  specialties?: string[];
  avatarUrl?: string;
  rating?: number;
  reviewCount?: number;
  memberSince?: string;
  tier?: WorkerTier; // Premium tier for verification badge
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  text: string;
  date: string;
}

export interface WorkerProfile {
  id: string;
  userId: string;
  name: string;
  role: string; // e.g., Electrician, Plumber
  location: string; // e.g., Accra, GH
  country: 'GH' | 'NG';
  avatarUrl: string;
  bio: string;
  hourlyRate: {
    min: number;
    max: number;
    currency: 'GHS' | 'NGN';
  };
  rating: number;
  reviewCount: number;
  skills: string[];
  tier: WorkerTier;
  verified: boolean;
  reviews: Review[];
  distance?: string; // Calculated distance string
  experienceYears?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  groundingUrls?: { uri: string; title: string }[];
}

export interface JobCategory {
  id: string;
  title: string;
  iconName: string;
}
