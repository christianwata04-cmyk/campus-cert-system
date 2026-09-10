'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';

export default function AuthPage() {
  const router = useRouter();

  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');

  // Student information
  const [yearLevel, setYearLevel] = useState('');
  const [program, setProgram] = useState('');
  const [section, setSection] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        // ============================================================
        // 1. VALIDATE STUDENT INFORMATION
        // ============================================================

        if (!studentNumber.trim()) {
          throw new Error(
            'Please enter your Student ID number to register.'
          );
        }

        if (!yearLevel) {
          throw new Error(
            'Please select your Year Level.'
          );
        }

        if (!program.trim()) {
          throw new Error(
            'Please enter your Program.'
          );
        }

        if (!section.trim()) {
          throw new Error(
            'Please enter your Section.'
          );
        }

        // ============================================================
        // 2. CHECK STUDENT ID WHITELIST
        // ============================================================

        const {
          data: allowedStudent,
          error: whitelistError,
        } = await supabase
          .from('allowed_students')
          .select('student_id')
          .eq('student_id', studentNumber.trim())
          .maybeSingle();

        if (whitelistError) {
          console.error(
            'Whitelist query error:',
            whitelistError
          );

          throw new Error(
            'Unable to verify Student ID. Please try again.'
          );
        }

        if (!allowedStudent) {
          throw new Error(
            'Your Student ID is not whitelisted or authorized to register. Please contact an admin.'
          );
        }

        // ============================================================
        // 3. CREATE SUPABASE AUTH ACCOUNT
        // ============================================================

        const {
          data: authData,
          error: authError,
        } = await supabase.auth.signUp({
          email,
          password,
        });

        if (authError) {
          throw authError;
        }

        // ============================================================
        // 4. INSERT STUDENT PROFILE INTO USERS TABLE
        // ============================================================

        if (authData.user) {
          const {
            error: profileError,
          } = await supabase
            .from('users')
            .insert([
              {
                id: authData.user.id,

                full_name: fullName.trim(),

                student_number: studentNumber.trim(),

                email: email.trim(),

                role: 'student',

                // NEW STUDENT INFORMATION
                year_level: yearLevel,

                program: program.trim(),

                section: section.trim(),
              },
            ]);

          if (profileError) {
            console.error(
              'Profile insert error:',
              profileError
            );

            throw profileError;
          }

          alert(
            'Account created successfully! You can now log in.'
          );

          // Clear registration fields
          setFullName('');
          setStudentNumber('');
          setYearLevel('');
          setProgram('');
          setSection('');
          setEmail('');
          setPassword('');

          setIsSignUp(false);
        }
      } else {
        // ============================================================
        // LOGIN FLOW
        // ============================================================

        const {
          data,
          error,
        } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        // ============================================================
        // FETCH USER ROLE
        // ============================================================

        const {
          data: userProfile,
          error: profileError,
        } = await supabase
          .from('users')
          .select('role')
          .eq('id', data.user.id)
          .single();

        if (profileError) {
          console.error(
            'User profile query error:',
            profileError
          );
        }

        // ============================================================
        // REDIRECT BASED ON ROLE
        // ============================================================

        if (
          userProfile?.role === 'officer' ||
          userProfile?.role === 'admin'
        ) {
          router.push('/admin/dashboard');
        } else {
          router.push('/student/dashboard');
        }
      }
    } catch (err: any) {
      console.error(
        'Authentication error:',
        err
      );

      alert(
        err?.message ||
          'An error occurred during authentication.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
      <div className="bg-slate-800 border border-slate-700 p-8 rounded-2xl w-full max-w-md shadow-2xl">

        {/* ============================================================
            HEADER
        ============================================================ */}

        <div className="text-center mb-8">
          <div className="inline-flex bg-indigo-600/20 p-3 rounded-full text-indigo-400 mb-3 border border-indigo-500/30">
            {isSignUp ? (
              <UserPlus className="w-8 h-8" />
            ) : (
              <LogIn className="w-8 h-8" />
            )}
          </div>

          <h1 className="text-2xl font-bold">
            {isSignUp
              ? 'Create Account'
              : 'Campus Check-In Portal'}
          </h1>

          <p className="text-slate-400 text-xs mt-1">
            {isSignUp
              ? 'Register to create your account'
              : 'Sign in to access your dashboard'}
          </p>
        </div>

        {/* ============================================================
            FORM
        ============================================================ */}

        <form
          onSubmit={handleAuth}
          className="space-y-4"
        >

          {/* ==========================================================
              SIGN UP ONLY FIELDS
          ========================================================== */}

          {isSignUp && (
            <>
              {/* FULL NAME */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Full Name
                </label>

                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={fullName}
                  onChange={(e) =>
                    setFullName(e.target.value)
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>

              {/* STUDENT NUMBER */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Student / ID Number
                </label>

                <input
                  type="text"
                  required
                  placeholder="e.g. 2025-0953"
                  value={studentNumber}
                  onChange={(e) =>
                    setStudentNumber(
                      e.target.value
                    )
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>

              {/* YEAR LEVEL */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Year Level
                </label>

                <select
                  required
                  value={yearLevel}
                  onChange={(e) =>
                    setYearLevel(
                      e.target.value
                    )
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm"
                >
                  <option value="">
                    Select Year Level
                  </option>

                  <option value="1st Year">
                    1st Year
                  </option>

                  <option value="2nd Year">
                    2nd Year
                  </option>

                  <option value="3rd Year">
                    3rd Year
                  </option>

                  <option value="4th Year">
                    4th Year
                  </option>
                </select>
              </div>

              {/* PROGRAM */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Program / Course
                </label>

                <input
                  type="text"
                  required
                  placeholder="e.g. Information Systems"
                  value={program}
                  onChange={(e) =>
                    setProgram(
                      e.target.value
                    )
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>

              {/* SECTION */}
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Section
                </label>

                <input
                  type="text"
                  required
                  placeholder="e.g. IS-2A"
                  value={section}
                  onChange={(e) =>
                    setSection(
                      e.target.value
                    )
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>
            </>
          )}

          {/* ==========================================================
              EMAIL
          ========================================================== */}

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
              Email Address
            </label>

            <input
              type="email"
              required
              placeholder="user@campus.edu"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm"
            />
          </div>

          {/* ==========================================================
              PASSWORD
          ========================================================== */}

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
              Password
            </label>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-4 pr-11 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm"
              />

              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>


          {/* ==========================================================
              SUBMIT BUTTON
          ========================================================== */}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition duration-200 text-sm mt-2 shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? 'Processing...'
              : isSignUp
              ? 'Register Account'
              : 'Sign In'}
          </button>
        </form>

        {/* ============================================================
            SWITCH LOGIN / REGISTER
        ============================================================ */}

        <div className="mt-6 pt-6 border-t border-slate-700/50 text-center">
          <button
            type="button"
            onClick={() =>
              setIsSignUp(!isSignUp)
            }
            className="text-xs text-indigo-400 hover:underline"
          >
            {isSignUp
              ? 'Already have an account? Sign In'
              : "Don't have an account? Sign Up"}
          </button>
        </div>

        {/* FOOTER CREDIT */}
        <div className="mt-5 text-center">
          <p className="text-xs text-slate-500">
            © 2026 Campus Check-In Portal
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Developed by <span className="text-slate-400">Christian Rey Wata</span>
          </p>
        </div>

      </div>
    </div>
  );
}