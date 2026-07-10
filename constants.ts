import { WorkerProfile, WorkerTier, JobCategory } from './types';

export const CATEGORIES: JobCategory[] = [
  { id: 'electrical', title: 'Electrical', iconName: 'Zap' },
  { id: 'plumbing', title: 'Plumbing', iconName: 'Droplet' },
  { id: 'carpentry', title: 'Carpentry', iconName: 'Hammer' },
  { id: 'painting', title: 'Painting', iconName: 'PaintBucket' },
  { id: 'hvac', title: 'HVAC / AC', iconName: 'Wind' },
  { id: 'cleaning', title: 'Cleaning', iconName: 'Sparkles' },
];