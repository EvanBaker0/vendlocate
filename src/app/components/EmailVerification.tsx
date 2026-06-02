import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Mail, CheckCircle, Loader2 } from 'lucide-react';
import { apiCall, supabase } from '../utils/supabase';

export default function EmailVerification() {
  const navigate = useNavigate();
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    const pendingEmail = sessionStorage.getItem('pending_verification_email');
    if (!pendingEmail) {
      navigate('/register');
      return;
    }
    setEmail(pendingEmail);
  }, [navigate]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Verify email
      await apiCall('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({
          email,
          code: verificationCode,
        }),
      });

      // Auto-login after verification
      const password = sessionStorage.getItem('pending_verification_password');
      if (password) {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (!signInError && data.session) {
          // Clear session storage
          sessionStorage.removeItem('pending_verification_email');
          sessionStorage.removeItem('pending_verification_password');

          setIsLoading(false);
          // Redirect to dashboard (they'll see the onboarding there)
          navigate('/dashboard');
          return;
        }
      }

      // Fallback to login page if auto-login fails
      setIsLoading(false);
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Verification failed');
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      // Trigger resend verification code
      setResendCooldown(60);
      // TODO: Implement resend endpoint on server
      console.log('Resend verification code for:', email);
    } catch (err) {
      console.error('Resend failed:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-indigo-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Verify Your Email</h1>
            <p className="text-gray-600">
              We've sent a 6-digit verification code to
            </p>
            <p className="text-gray-900 font-medium mt-1">{email}</p>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>For demo purposes:</strong> Check your browser console for the verification code
              (in production, this would be sent via email)
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2">
                Verification Code
              </label>
              <input
                id="code"
                type="text"
                required
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-center text-2xl tracking-widest"
                placeholder="000000"
                maxLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || verificationCode.length !== 6}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Verify Email
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600 text-sm mb-2">Didn't receive the code?</p>
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="text-indigo-600 hover:text-indigo-700 font-medium text-sm disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
