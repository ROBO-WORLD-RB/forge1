import React, { useState } from 'react';
import { UserRole } from '../../types';
import { Eye, EyeOff, Check } from 'lucide-react';
import Input from '../components/Input';
import Button from '../components/Button';

interface SignupFormProps {
  onSuccess: (data: any) => void;
  role: UserRole;
  country: 'GH' | 'NG';
}

export const SignupForm: React.FC<SignupFormProps> = ({ onSuccess, role, country }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const getPasswordStrength = (pwd: string) => ({
    minLength: pwd.length >= 8,
    hasUpper: /[A-Z]/.test(pwd),
    hasNumber: /\d/.test(pwd),
    hasSpecial: /[^A-Za-z0-9]/.test(pwd),
  });

  const strength = getPasswordStrength(password);
  const isPasswordValid = strength.minLength && strength.hasUpper && strength.hasNumber;
  const doPasswordsMatch = password === confirmPassword && password.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPasswordValid && doPasswordsMatch) {
      onSuccess({ email, password });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in">
      <Input label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      
      <div className="relative">
        <Input 
          label="Password" 
          type={showPassword ? 'text' : 'password'} 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          required 
        />
        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-8 text-gray-400">
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
        <div className={strength.minLength ? 'text-green-600' : ''}>Min 8 chars</div>
        <div className={strength.hasUpper ? 'text-green-600' : ''}>Uppercase</div>
        <div className={strength.hasNumber ? 'text-green-600' : ''}>Number</div>
        <div className={strength.hasSpecial ? 'text-green-600' : ''}>Symbol</div>
      </div>

      <Input 
        label="Confirm Password" 
        type="password" 
        value={confirmPassword} 
        onChange={(e) => setConfirmPassword(e.target.value)} 
        required 
      />

      <Button fullWidth type="submit" disabled={!isPasswordValid || !doPasswordsMatch}>
        Create Account
      </Button>
    </form>
  );
};
