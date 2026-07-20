import React from 'react';
import { WorkerProfile, WorkerTier } from '../types';
import { Star, MapPin, ShieldCheck } from 'lucide-react';
import Button from './Button';

interface WorkerCardProps {
  worker: WorkerProfile;
  onViewProfile: (id: string) => void;
}

export const WorkerCardSkeleton: React.FC = () => (
  <div
    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full"
    aria-hidden="true"
  >
    <div className="relative h-28 sm:h-32 shimmer" />
    <div className="pt-12 px-4 pb-4 flex-grow flex flex-col">
      <div className="flex justify-between items-start mb-3 gap-2">
        <div className="flex-1 space-y-2 min-w-0">
          <div className="h-5 w-3/4 rounded-lg shimmer" />
          <div className="h-4 w-1/2 rounded-lg shimmer" />
        </div>
        <div className="h-7 w-16 rounded-lg shimmer shrink-0" />
      </div>
      <div className="h-4 w-2/5 rounded-lg shimmer mb-3" />
      <div className="flex gap-1.5 mb-4">
        <div className="h-6 w-14 rounded-md shimmer" />
        <div className="h-6 w-16 rounded-md shimmer" />
        <div className="h-6 w-12 rounded-md shimmer" />
      </div>
      <div className="mt-auto pt-3 border-t border-gray-50 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-5 w-20 rounded-lg shimmer" />
        <div className="h-10 w-full sm:w-28 rounded-xl shimmer" />
      </div>
    </div>
  </div>
);

const WorkerCard: React.FC<WorkerCardProps> = ({ worker, onViewProfile }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md hover:border-forge-orange/20 transition-all duration-200 flex flex-col h-full group">
      <div className="relative h-28 sm:h-32 bg-gradient-to-br from-forge-navy/10 to-forge-navy/5">
        {worker.tier === WorkerTier.PREMIUM && (
          <div className="absolute top-2 right-2 bg-gradient-to-r from-forge-orange to-orange-500 text-white text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide shadow-sm flex items-center gap-1">
            <span>⭐</span> Premium
          </div>
        )}
        {worker.tier === WorkerTier.BASIC && (
          <div className="absolute top-2 right-2 bg-forge-cyan text-white text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide shadow-sm">
            Verified
          </div>
        )}
        <div className="absolute -bottom-10 left-4">
          <img
            src={worker.avatarUrl}
            alt={worker.name}
            loading="lazy"
            decoding="async"
            className="w-20 h-20 rounded-full border-4 border-white object-cover shadow-sm bg-gray-100 group-hover:scale-105 transition-transform duration-200"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.name)}&background=random`;
            }}
          />
        </div>
      </div>

      <div className="pt-12 px-4 pb-4 flex-grow flex flex-col min-w-0">
        <div className="flex justify-between items-start mb-1 gap-2">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-1 min-w-0">
              <span className="truncate">{worker.name}</span>
              {worker.verified && (
                <span title="KYC verified" className="shrink-0">
                  <ShieldCheck className="w-4 h-4 text-forge-cyan" />
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-500 font-medium truncate">{worker.role}</p>
            {worker.verified && (
              <p className="text-[10px] text-forge-cyan font-semibold mt-0.5">Verified pro</p>
            )}
          </div>
          {worker.reviewCount > 0 ? (
            <div className="flex items-center bg-orange-50 px-2 py-1 rounded shrink-0" title="Average from real customer reviews">
              <Star className="w-4 h-4 text-forge-warning fill-current" />
              <span className="ml-1 text-sm font-bold text-gray-900">{worker.rating.toFixed(1)}</span>
              <span className="ml-1 text-xs text-gray-500">({worker.reviewCount})</span>
            </div>
          ) : (
            <div className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded shrink-0">New</div>
          )}
        </div>

        <div className="flex items-center text-gray-500 text-sm mb-3 min-w-0">
          <MapPin className="w-3 h-3 mr-1 shrink-0" />
          <span className="truncate">{worker.location}</span>
        </div>

        <div className="flex flex-wrap gap-1 mb-4">
          {worker.skills.slice(0, 3).map((skill) => (
            <span key={skill} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md truncate max-w-full">
              {skill}
            </span>
          ))}
          {worker.skills.length > 3 && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
              +{worker.skills.length - 3}
            </span>
          )}
        </div>

        <div className="mt-auto pt-3 border-t border-gray-50 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-forge-navy font-bold">
            {worker.hourlyRate.currency} {worker.hourlyRate.min}
            <span className="text-xs font-normal text-gray-500">/hr</span>
          </div>
          <Button size="sm" onClick={() => onViewProfile(worker.userId)} className="w-full sm:w-auto min-h-[44px]">
            View Profile
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WorkerCard;
