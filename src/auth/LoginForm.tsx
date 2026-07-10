import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import Input from '../components/Input';
import Button from '../components/Button';

interface LoginFormProps {
  onSuccess: (data: any) => void;
  isLoading: boolean;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, isLoading }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSuccess({ email, password });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      
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

      <Button fullWidth type="submit" loading={isLoading}>
        Sign In
      </Button>
    </form>
  );
};
