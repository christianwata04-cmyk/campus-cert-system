'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { LogOut, Plus, Calendar, QrCode, ShieldCheck, User } from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (err: any) {
      console.error('Error fetching events:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      <div>
        {/* Top Navigation Bar */}
        <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600/20 p-2 rounded-lg border border-indigo-500/30 text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white leading-tight">Campus Cert System</h1>
              <p className="text-xs text-indigo-400 font-medium">Officer Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin/scan')}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-lg border border-slate-700 transition"
            >
              <QrCode className="w-4 h-4 text-indigo-400" />
              Scanner Mode
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 text-xs font-semibold px-4 py-2 rounded-lg border border-rose-500/20 transition"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="max-w-6xl mx-auto p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-3xl font-extrabold text-white">Officer Dashboard</h2>
              <p className="text-slate-400 text-sm mt-1">
                Manage campus events, generate QR check-ins, and track attendance.
              </p>
            </div>

            <button
              onClick={() => alert('Create Event modal / page trigger')}
              className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition text-sm"
            >
              <Plus className="w-4 h-4" />
              Create New Event
            </button>
          </div>

          {/* Active Campus Events */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              Active Campus Events
            </h3>

            {loading ? (
              <div className="text-center py-12 text-slate-500 text-sm">Loading events...</div>
            ) : events.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/40 rounded-xl border border-slate-800/80">
                <p className="text-slate-400 text-sm">
                  No events created yet. Click <span className="text-indigo-400 font-semibold">"Create New Event"</span> above to publish your first event!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {events.map((event) => (
                  <div key={event.id} className="bg-slate-800 border border-slate-700 p-4 rounded-xl">
                    <h4 className="font-bold text-white">{event.title}</h4>
                    <p className="text-xs text-slate-400 mt-1">{event.location}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Developer / Owner Credit Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-4 px-6 text-center text-xs text-slate-500">
        <p>
          © 2026 Campus Certificate & Attendance System • Developed & Owned by{' '}
          <span className="text-indigo-400 font-semibold">Christian Rey Wata</span>
        </p>
      </footer>
    </div>
  );
}