import React from 'react';
import { Check, X } from 'lucide-react';

interface PasswordStrengthMeterProps {
  password: string;
}

const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ password }) => {
  const requirements = [
    { label: 'At least 8 characters', test: (s: string) => s.length >= 8 },
    { label: 'Contains uppercase letter', test: (s: string) => /[A-Z]/.test(s) },
    { label: 'Contains lowercase letter', test: (s: string) => /[a-z]/.test(s) },
    { label: 'Contains a number', test: (s: string) => /[0-9]/.test(s) },
    { label: 'Contains special character', test: (s: string) => /[^A-Za-z0-9]/.test(s) },
  ];

  const strength = requirements.filter(req => req.test(password)).length;
  
  const getStrengthColor = () => {
    if (strength === 0) return 'bg-gray-200';
    if (strength <= 2) return 'bg-red-500';
    if (strength <= 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthText = () => {
    if (password.length === 0) return '';
    if (strength <= 2) return 'Weak';
    if (strength <= 4) return 'Fair';
    return 'Strong';
  };

  return (
    <div className="mt-4 space-y-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Security Strength</span>
        <span className={`text-xs font-bold ${strength > 4 ? 'text-green-600' : strength > 2 ? 'text-yellow-600' : 'text-red-600'}`}>
          {getStrengthText()}
        </span>
      </div>
      
      {/* Strength Bar */}
      <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden flex gap-1">
        {[1, 2, 3, 4, 5].map((idx) => (
          <div 
            key={idx}
            className={`h-full flex-1 transition-all duration-500 ${
              idx <= strength ? getStrengthColor() : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 mt-4">
        {requirements.map((req, idx) => {
          const isMet = req.test(password);
          return (
            <div key={idx} className="flex items-center gap-2">
              <div className={`p-0.5 rounded-full ${isMet ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                {isMet ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
              </div>
              <span className={`text-xs ${isMet ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                {req.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PasswordStrengthMeter;
