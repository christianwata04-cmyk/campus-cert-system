'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { LogIn, UserPlus, KeyRound, ArrowLeft, Eye, EyeOff } from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isResetting) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) throw error;
        alert('A password reset link has been sent to your email address!');
        setIsResetting(false);
      } else if (isSignUp) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) throw authError;

        if (authData.user) {
          const { error: profileError } = await supabase.from('users').insert([
            {
              id: authData.user.id,
              full_name: fullName,
              student_number: studentNumber || 'N/A',
              email: email,
              role: 'student',
            },
          ]);

          if (profileError) throw profileError;

          alert('Account created successfully! You can now log in.');
          setIsSignUp(false);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        const { data: userProfile } = await supabase
          .from('users')
          .select('role')
          .eq('id', data.user.id)
          .single();

        if (userProfile?.role === 'officer' || userProfile?.role === 'admin') {
          router.push('/admin/dashboard');
        } else {
          router.push('/student/dashboard');
        }
      }
    } catch (err: any) {
      alert(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
      <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex bg-indigo-600/20 p-3 rounded-full text-indigo-400 mb-3 border border-indigo-500/30">
            {isResetting ? (
              <KeyRound className="w-8 h-8" />
            ) : isSignUp ? (
              <UserPlus className="w-8 h-8" />
            ) : (
              <LogIn className="w-8 h-8" />
            )}
          </div>
          <h1 className="text-2xl font-bold">
            {isResetting ? 'Reset Password' : isSignUp ? 'Create Account' : 'Campus Check-In Portal'}
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            {isResetting
              ? 'Enter your email to receive a password reset link'
              : isSignUp
              ? 'Register to create your account'
              : 'Sign in to access your dashboard'}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {isSignUp && !isResetting && (
            <>
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Student / ID Number <span className="text-slate-500 font-normal">(Optional for Officers)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2026-00123"
                  value={studentNumber}
                  onChange={(e) => setStudentNumber(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">Email Address</label>
            <input
              type="email"
              required
              placeholder="user@campus.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm"
            />
          </div>

          {!isResetting && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs uppercase tracking-wider text-slate-400">Password</label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => setIsResetting(true)}
                    className="text-xs text-indigo-400 hover:underline"
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-4 pr-10 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition duration-200 text-sm mt-2 shadow-lg shadow-indigo-600/20"
          >
            {loading
              ? 'Processing...'
              : isResetting
              ? 'Send Reset Link'
              : isSignUp
              ? 'Register Account'
              : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-700/50 text-center">
          {isResetting ? (
            <button
              onClick={() => setIsResetting(false)}
              className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
            </button>
          ) : (
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-indigo-400 hover:underline"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}