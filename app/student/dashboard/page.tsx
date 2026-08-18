'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { QRCodeSVG } from 'qrcode.react';
import { Calendar, LogOut, UserCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function StudentDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfileAndEvents();
  }, []);

  const fetchProfileAndEvents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // 1. Fetch Student User Info
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(userData);

      // 2. Fetch Events
      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .order('event_date', { ascending: true });

      setEvents(eventData || []);
    } catch (err: any) {
      console.error('Error fetching student dashboard data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center text-sm">
        Loading student pass...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-indigo-400">Student Portal</h1>
            <p className="text-slate-400 text-xs mt-1">Logged in as {profile?.full_name}</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl transition flex items-center gap-2 text-xs"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>

        {/* Digital Student QR Pass */}
        <div className="bg-slate-800 border border-slate-700 p-8 rounded-3xl text-center shadow-2xl flex flex-col items-center">
          <div className="flex items-center gap-2 bg-indigo-500/20 text-indigo-300 text-xs font-semibold px-4 py-1.5 rounded-full border border-indigo-500/30 mb-6">
            <UserCheck className="w-4 h-4" /> Official Event Digital Pass
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-xl my-2">
            <QRCodeSVG value={profile?.id || ''} size={200} />
          </div>

          <h2 className="text-xl font-bold text-white mt-5">{profile?.full_name}</h2>
          <p className="text-xs text-indigo-400 font-mono mt-1">
            Student ID: {profile?.student_number || 'N/A'}
          </p>
          <p className="text-slate-400 text-[11px] mt-3 max-w-xs">
            Present this QR code to event officers at the entrance during check-in.
          </p>
        </div>

        {/* Upcoming Events List */}
        <div>
          <h3 className="text-base font-bold mb-4 text-slate-200">Campus Events</h3>
          {events.length === 0 ? (
            <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl text-center text-slate-400 text-xs">
              No upcoming events posted yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map((event) => (
                <div key={event.id} className="bg-slate-800 border border-slate-700 p-5 rounded-xl">
                  <h4 className="font-bold text-indigo-300 text-sm">{event.title}</h4>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{event.description}</p>
                  <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                      {new Date(event.event_date).toLocaleDateString()}
                    </span>
                    <span>{event.location}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}