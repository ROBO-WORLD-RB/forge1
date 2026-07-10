import React from 'react';
import { UserRole } from '../../types';
import { Briefcase, User } from 'lucide-react';

interface RoleSelectorProps {
  onSelect: (role: UserRole) => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({ onSelect }) => (
  <div className="grid grid-cols-1 gap-4 animate-in fade-in">
    <button
      onClick={() => onSelect(UserRole.WORKER)}
      className="p-6 flex items-center gap-4 border-2 border-gray-100 rounded-2xl hover:border-forge-orange transition-all text-left"
    >
      <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-forge-orange">
        <Briefcase size={24} />
      </div>
      <div>
        <h3 className="font-bold text-lg">Skilled Worker</h3>
        <p className="text-sm text-gray-500">Offer your services and earn.</p>
      </div>
    </button>

    <button
      onClick={() => onSelect(UserRole.CUSTOMER)}
      className="p-6 flex items-center gap-4 border-2 border-gray-100 rounded-2xl hover:border-forge-navy transition-all text-left"
    >
      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-forge-navy">
        <User size={24} />
      </div>
      <div>
        <h3 className="font-bold text-lg">Customer</h3>
        <p className="text-sm text-gray-500">Find professionals for your project.</p>
      </div>
    </button>
  </div>
);
