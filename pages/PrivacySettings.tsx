import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  ArrowLeft,
  Shield,
  Lock,
  Eye,
  KeyRound,
  Mail,
} from 'lucide-react';
import PageHelmet from '../components/PageHelmet';

const PrivacySettings: React.FC = () => {
  const { user } = useAuth();

  return (
    <>
      <PageHelmet title="Privacy & Security" path="/settings/privacy" />
      <div className="min-h-dynamic bg-gray-50 px-4 pb-nav pt-4 md:pt-6 overflow-x-hidden">
        <div className="max-w-2xl mx-auto py-6">
          <Link
            to="/my-profile"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-forge-navy mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Profile
          </Link>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-forge-navy/10 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-forge-navy" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-forge-navy">Privacy & Security</h1>
              <p className="text-sm text-gray-500">Manage how your account stays protected</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
            <div className="p-5 border-b border-gray-50">
              <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <Eye className="w-4 h-4 text-gray-400" />
                Your data
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                FORGE uses your profile details (name, contact, location, and work history) to connect
                customers with workers and to power bookings and messaging. We do not sell your personal
                information.
              </p>
            </div>
            <div className="p-5 border-b border-gray-50">
              <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <Lock className="w-4 h-4 text-gray-400" />
                Visibility
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Worker profiles are public so customers can find and book you. Customers&apos; private
                contact details stay limited to people involved in a booking or conversation.
              </p>
            </div>
            <div className="p-5">
              <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                Account email
              </h2>
              <p className="text-sm text-gray-600">
                Signed in as{' '}
                <span className="font-medium text-gray-900">{user?.email || 'your account'}</span>
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-gray-400" />
              Password
            </h2>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              To change your password, we&apos;ll send a secure reset link to your email.
            </p>
            <Link
              to="/auth/forgot-password"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-forge-navy text-white text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              Change password
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default PrivacySettings;
