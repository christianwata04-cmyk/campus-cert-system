'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, MapPin, Plus, QrCode, Users, X, Award, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useAdminGuard } from '@/lib/useAdminGuard';

interface Event {
  id: string;
  title: string;
  description: string;
  event_date: string;
  location: string;
}

interface Attendee {
  id: string;
  users: {
    full_name: string;
    student_number: string;
    email: string;
  };
}

export default function AdminDashboard() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  useAdminGuard();
  
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loadingAttendees, setLoadingAttendees] = useState(false);
  const [selectedCertificate, setSelectedCertificate] = useState<{ studentName: string; eventTitle: string; date: string } | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventDate: '',
    location: '',
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
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

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('events').insert([
        {
          title: formData.title,
          description: formData.description,
          event_date: formData.eventDate,
          start_time: formData.eventDate,
          end_time: formData.eventDate,
          venue: formData.location,
          location: formData.location,
        },
      ]);

      if (error) throw error;

      setFormData({ title: '', description: '', eventDate: '', location: '' });
      setShowForm(false);
      fetchEvents();
    } catch (err: any) {
      alert('Error creating event: ' + err.message);
    }
  };

  const fetchAttendees = async (event: Event) => {
    setSelectedEvent(event);
    setLoadingAttendees(true);
    try {
      const { data, error } = await supabase
        .from('attendances')
        .select(`
          id,
          users (
            full_name,
            student_number,
            email
          )
        `)
        .eq('event_id', event.id);

      if (error) throw error;
      setAttendees((data as any) || []);
    } catch (err: any) {
      alert('Error fetching attendees: ' + err.message);
    } finally {
      setLoadingAttendees(false);
    }
  };

  const exportToCSV = () => {
    if (!selectedEvent || attendees.length === 0) return;

    const headers = ['Student Name', 'Student Number', 'Email', 'Status'];
    const rows = attendees.map((a) => [
      `"${a.users?.full_name || 'N/A'}"`,
      `"${a.users?.student_number || 'N/A'}"`,
      `"${a.users?.email || 'N/A'}"`,
      '"Verified Present"',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${selectedEvent.title}_Roster.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-800">
          <div>
            <h1 className="text-3xl font-bold text-indigo-400">Officer Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">
              Manage campus events, generate QR check-ins, and track attendance
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2.5 rounded-xl transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-indigo-600/20"
          >
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'Create New Event'}
          </button>
        </div>

        {/* Create Event Modal / Form */}
        {showForm && (
          <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl mb-8 shadow-xl">
            <h2 className="text-xl font-bold text-white mb-4">Create New Campus Event</h2>
            <form onSubmit={handleCreateEvent} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Tech Symposium 2026"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Venue / Location
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Main Auditorium"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formData.eventDate}
                  onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g., Annual campus developer meetup"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="md:col-span-2 mt-2">
                <button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-lg transition duration-200"
                >
                  Publish Event
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Event List */}
        <h2 className="text-xl font-bold mb-4 text-slate-200">Active Campus Events</h2>

        {loading ? (
          <p className="text-slate-400">Loading events...</p>
        ) : events.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
            No events created yet. Click <strong>"Create New Event"</strong> above to publish your first event!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-indigo-500/50 transition duration-200 flex flex-col justify-between"
              >
                <div>
                  <h3 className="text-xl font-bold text-indigo-300 mb-2">{event.title}</h3>
                  <p className="text-slate-400 text-sm mb-4 line-clamp-2">
                    {event.description || 'No description provided.'}
                  </p>

                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-indigo-400" />
                      <span>{new Date(event.event_date).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-indigo-400" />
                      <span>{event.location}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-700/50 flex gap-3">
                  <Link
                    href="/admin/scan"
                    className="flex-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-medium py-2 rounded-lg text-sm border border-indigo-500/30 flex items-center justify-center gap-2 transition"
                  >
                    <QrCode className="w-4 h-4" />
                    Scan QR Check-in
                  </Link>
                  <button
                    onClick={() => fetchAttendees(event)}
                    className="bg-slate-700 hover:bg-slate-600 text-slate-200 py-2 px-4 rounded-lg text-sm flex items-center justify-center gap-2 transition"
                    title="View Roster"
                  >
                    <Users className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Attendees Modal */}
        {selectedEvent && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
              
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-700 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedEvent.title}</h3>
                  <p className="text-xs text-indigo-400 mt-1">Verified Attendee Roster</p>
                </div>
                <div className="flex items-center gap-2">
                  {attendees.length > 0 && (
                    <button
                      onClick={exportToCSV}
                      className="bg-slate-700 hover:bg-slate-600 text-xs text-slate-200 px-3 py-1.5 rounded-lg border border-slate-600 font-medium transition"
                    >
                      Export CSV
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedEvent(null)}
                    className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 overflow-y-auto flex-1">
                {loadingAttendees ? (
                  <p className="text-center text-slate-400 py-8">Loading attendance record...</p>
                ) : attendees.length === 0 ? (
                  <p className="text-center text-slate-400 py-8">No attendees have checked in yet.</p>
                ) : (
                  <div className="space-y-3">
                    {attendees.map((attendee) => (
                      <div
                        key={attendee.id}
                        className="bg-slate-900 border border-slate-700/60 p-4 rounded-xl flex items-center justify-between gap-4"
                      >
                        <div>
                          <p className="font-semibold text-white">{attendee.users?.full_name || 'Student'}</p>
                          <p className="text-xs text-slate-400 font-mono">
                            ID: {attendee.users?.student_number || 'N/A'} | Status:{' '}
                            <span className="text-emerald-400 font-semibold">Verified Present</span>
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            setSelectedCertificate({
                              studentName: attendee.users?.full_name || 'Student',
                              eventTitle: selectedEvent.title,
                              date: new Date(selectedEvent.event_date).toLocaleDateString(),
                            })
                          }
                          className="bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shrink-0"
                        >
                          <Award className="w-3.5 h-3.5" /> Certificate
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* Certificate Printable Modal */}
        {selectedCertificate && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
            <div className="bg-slate-950 border-4 border-amber-500/50 p-8 rounded-2xl w-full max-w-xl text-center relative shadow-2xl">
              
              <button
                onClick={() => setSelectedCertificate(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="border-2 border-dashed border-amber-500/30 p-8 rounded-xl bg-slate-900/50">
                <div className="inline-block bg-amber-500/10 p-3 rounded-full text-amber-400 mb-4 border border-amber-500/30">
                  <Award className="w-8 h-8" />
                </div>
                
                <h4 className="text-xs font-bold uppercase tracking-widest text-amber-400 mb-2">
                  Certificate of Participation
                </h4>
                
                <p className="text-xs text-slate-400 mb-4">This is proudly presented to</p>
                
                <h2 className="text-2xl font-extrabold text-white mb-2 underline decoration-amber-500 underline-offset-8">
                  {selectedCertificate.studentName}
                </h2>
                
                <p className="text-xs text-slate-400 my-4 leading-relaxed">
                  For actively participating in <strong className="text-indigo-300">{selectedCertificate.eventTitle}</strong> held on {selectedCertificate.date}.
                </p>

                <div className="mt-8 pt-4 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500">
                  <span>Verified Campus System</span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle className="w-3 h-3" /> Official Record
                  </span>
                </div>
              </div>

              <button
                onClick={() => window.print()}
                className="mt-6 bg-amber-600 hover:bg-amber-500 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition shadow-lg shadow-amber-600/20"
              >
                Print / Save Certificate
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}