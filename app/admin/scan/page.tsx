'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Html5Qrcode } from 'html5-qrcode';
import { ArrowLeft, CheckCircle2, AlertCircle, Camera, CameraOff } from 'lucide-react';
import Link from 'next/link';
import { useAdminGuard } from '@/lib/useAdminGuard';

export default function ScanPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string; user?: any } | null>(null);
  const [manualId, setManualId] = useState('');
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  useAdminGuard();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    const { data } = await supabase.from('events').select('*').order('event_date', { ascending: true });
    if (data && data.length > 0) {
      setEvents(data);
      setSelectedEventId(data[0].id);
    }
  };

  const startScanner = async () => {
    if (!selectedEventId) {
      alert('Please select an event first!');
      return;
    }

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('reader');
      }

      if (html5QrCodeRef.current.isScanning) {
        await html5QrCodeRef.current.stop();
      }

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 220, height: 220 },
        },
        onScanSuccess,
        onScanFailure
      );

      setIsScanning(true);
    } catch (err: any) {
      console.error('Camera start error:', err);
    }
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      await html5QrCodeRef.current.stop();
      setIsScanning(false);
    }
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch((e) => console.error(e));
      }
    };
  }, []);

  const processAttendance = async (userId: string) => {
    if (!selectedEventId) {
      setScanResult({ success: false, message: 'Please select an event first!' });
      return;
    }

    setLoading(true);

    try {
      // 1. Fetch user profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId.trim())
        .single();

      if (userError || !userData) {
        throw new Error('Invalid QR Code: Student account not found.');
      }

      // 2. Check duplicate check-in
      const { data: existingCheckIn } = await supabase
        .from('attendances')
        .select('*')
        .eq('event_id', selectedEventId)
        .eq('user_id', userId.trim())
        .single();

      if (existingCheckIn) {
        setScanResult({
          success: false,
          message: `${userData.full_name} is ALREADY checked in!`,
          user: userData,
        });
        return;
      }

      // 3. Record attendance
      const { error: insertError } = await supabase.from('attendances').insert([
        {
          event_id: selectedEventId,
          user_id: userId.trim(),
          status: 'present',
        },
      ]);

      if (insertError) throw insertError;

      setScanResult({
        success: true,
        message: `Verified check-in for ${userData.full_name}!`,
        user: userData,
      });
    } catch (err: any) {
      setScanResult({
        success: false,
        message: err.message || 'Failed to process check-in.',
      });
    } finally {
      setLoading(false);
    }
  };

  const onScanSuccess = (decodedText: string) => {
    processAttendance(decodedText);
  };

  const onScanFailure = () => {
    // Silent fail while looking for QR
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualId) {
      processAttendance(manualId);
      setManualId('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 md:p-10">
      <div className="max-w-xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/admin/dashboard"
            className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </Link>
        </div>

        <div className="text-center">
          <h1 className="text-2xl font-bold text-indigo-400">Event Check-In Scanner</h1>
          <p className="text-slate-400 text-xs mt-1">
            Scan student QR codes or type Student UUID manually
          </p>
        </div>

        {/* Event Selector */}
        <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl">
          <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2 font-semibold">
            Select Active Event:
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm"
          >
            {events.map((evt) => (
              <option key={evt.id} value={evt.id}>
                {evt.title} ({new Date(evt.event_date).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>

        {/* Scan Feedback Banner */}
        {scanResult && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              scanResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {scanResult.success ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            )}
            <div>
              <p className="font-bold text-sm">{scanResult.message}</p>
              {scanResult.user && (
                <p className="text-xs mt-1 text-slate-300 font-mono">
                  Student ID: {scanResult.user.student_number || 'N/A'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Clean Camera Container */}
        <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl text-center space-y-4 shadow-xl">
          <div className="relative w-full aspect-square max-w-sm mx-auto bg-slate-900 rounded-xl overflow-hidden border border-slate-700 flex items-center justify-center">
            <div id="reader" className="w-full h-full [&>video]:object-cover [&>video]:w-full [&>video]:h-full" />
            {!isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-slate-400 p-4">
                <Camera className="w-10 h-10 mb-2 text-slate-500" />
                <p className="text-xs">Camera is currently stopped</p>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-center">
            {!isScanning ? (
              <button
                onClick={startScanner}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition inline-flex items-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                <Camera className="w-4 h-4" /> Start Camera
              </button>
            ) : (
              <button
                onClick={stopScanner}
                className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition inline-flex items-center gap-2"
              >
                <CameraOff className="w-4 h-4" /> Stop Camera
              </button>
            )}
          </div>
        </div>

        {/* Manual Check-in Backup */}
        <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl">
          <h3 className="text-xs font-semibold uppercase text-slate-400 mb-2">
            Manual Check-In Backup
          </h3>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Paste or type Student User UUID..."
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition"
            >
              {loading ? 'Checking...' : 'Check In'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}