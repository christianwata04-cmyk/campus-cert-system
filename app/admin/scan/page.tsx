'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Html5Qrcode } from 'html5-qrcode';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Camera,
  CameraOff,
  Clock,
  LogIn,
  LogOut,
} from 'lucide-react';
import Link from 'next/link';
import { useAdminGuard } from '@/lib/useAdminGuard';

export default function ScanPage() {
  // ============================================================
  // ADMIN GUARD
  // ============================================================

  useAdminGuard();

  // ============================================================
  // EVENTS
  // ============================================================

  const [events, setEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] =
    useState<string>('');

  // ============================================================
  // SESSIONS
  // ============================================================

  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] =
    useState<string>('');
  const [activeSession, setActiveSession] =
    useState<any | null>(null);

  // Keep the session/event available to QR callbacks without stale closures.
  // The scanner callback can continue running after React state changes
  // from Morning -> Afternoon, so refs must hold the latest values.
  const activeSessionRef =
    useRef<any | null>(null);

  const sessionsRef =
    useRef<any[]>([]);

  const selectedEventIdRef =
    useRef<string>('');


  // ============================================================
  // SCAN RESULT
  // ============================================================

  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
    user?: any;
    status?: string;
    action?: 'CHECK_IN' | 'CHECK_OUT';
  } | null>(null);

  // ============================================================
  // MANUAL ID
  // ============================================================

  const [manualId, setManualId] = useState('');

  // ============================================================
  // LOADING / CAMERA
  // ============================================================

  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // ============================================================
  // LIVE REFS FOR SCANNER CALLBACKS
  // ============================================================

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    selectedEventIdRef.current = selectedEventId;
  }, [selectedEventId]);

  // ============================================================
  // QR SCANNER
  // ============================================================

  const html5QrCodeRef =
    useRef<Html5Qrcode | null>(null);

  const processingScanRef =
    useRef(false);

  // ============================================================
  // FETCH EVENTS
  // ============================================================

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const {
        data,
        error,
      } = await supabase
        .from('events')
        .select('*')
        .order('event_date', {
          ascending: true,
        });
        console.log(
  'EVENTS FROM DATABASE:',
  data
);

console.table(
  (data || []).map((event: any) => ({
    id: event.id,
    name: event.name,
    event_date: event.event_date,
    event_date_type: typeof event.event_date,
  }))
);

      if (error) {
        console.error(
          'Error fetching events:',
          error
        );
        return;
      }

      if (data && data.length > 0) {
        setEvents(data);

        selectedEventIdRef.current =
          data[0].id;

        setSelectedEventId(
          data[0].id
        );
      } else {
        selectedEventIdRef.current = '';
        setEvents([]);
        setSelectedEventId('');
      }
    } catch (error) {
      console.error(
        'Unexpected error fetching events:',
        error
      );
    }
  };

  // ============================================================
  // FETCH SESSIONS WHEN EVENT CHANGES
  // ============================================================

  useEffect(() => {
    if (selectedEventId) {
      fetchSessions(
        selectedEventId
      );
    } else {
      sessionsRef.current = [];
      activeSessionRef.current = null;
      setSessions([]);
      setSelectedSessionId('');
      setActiveSession(null);
    }
  }, [selectedEventId]);

  // ============================================================
  // FETCH EVENT SESSIONS
  // ============================================================

  const fetchSessions = async (
    eventId: string
  ) => {
    try {
      const {
        data,
        error,
      } = await supabase
        .from('dev_event_sessions')
        .select('*')
        .eq(
          'event_id',
          eventId
        )
        .order(
          'attendance_start',
          {
            ascending: true,
          }
        );

      if (error) {
        console.error(
          'Error fetching sessions:',
          error
        );

        sessionsRef.current = [];
        activeSessionRef.current = null;
        setSessions([]);
        setSelectedSessionId('');
        setActiveSession(null);

        return;
      }

      if (
        data &&
        data.length > 0
      ) {
        setSessions(data);

        const currentSession =
          getCurrentSession(data);

        const initialSession =
          currentSession || data[0];

        setSelectedSessionId(
          initialSession.id
        );

        activeSessionRef.current =
          initialSession;

        sessionsRef.current =
          data;

        setActiveSession(
          initialSession
        );
      } else {
        sessionsRef.current = [];
        activeSessionRef.current = null;
        setSessions([]);
        setSelectedSessionId('');
        setActiveSession(null);
      }
    } catch (error) {
      console.error(
        'Unexpected error fetching sessions:',
        error
      );

      sessionsRef.current = [];
      activeSessionRef.current = null;
      setSessions([]);
      setSelectedSessionId('');
      setActiveSession(null);
    }
  };

  // ============================================================
  // HANDLE SESSION CHANGE
  // ============================================================

  const handleSessionChange = (
    sessionId: string
  ) => {
    setSelectedSessionId(
      sessionId
    );

    const foundSession =
      sessions.find(
        (session) =>
          session.id ===
          sessionId
      );

    activeSessionRef.current =
      foundSession || null;

    setActiveSession(
      foundSession || null
    );

    setScanResult(null);
  };

  // ============================================================
  // AUTOMATIC MORNING / AFTERNOON SESSION SWITCH
  //
  // The scanner checks every 15 seconds so a FULL DAY event can
  // move from Morning to Afternoon without reloading the page.
  // ============================================================

  useEffect(() => {
    if (!sessions.length) {
      return;
    }

    const updateActiveSessionByTime = () => {
      const currentSession =
        getCurrentSession(sessions);

      if (
        currentSession &&
        currentSession.id !== selectedSessionId
      ) {
        console.log(
          'AUTO SESSION SWITCH:',
          currentSession.session_name,
          currentSession.id
        );

        setSelectedSessionId(
          currentSession.id
        );

        activeSessionRef.current =
          currentSession;

        setActiveSession(
          currentSession
        );

        setScanResult(null);
      }
    };

    updateActiveSessionByTime();

    const interval = window.setInterval(
      updateActiveSessionByTime,
      15000
    );

    return () => {
      window.clearInterval(interval);
    };
  }, [sessions, selectedSessionId]);

  // ============================================================
  // STOP CAMERA WHEN EVENT CHANGES
  // ============================================================

  useEffect(() => {
    const stopCameraOnEventChange =
      async () => {
        if (
          html5QrCodeRef.current &&
          html5QrCodeRef.current.isScanning
        ) {
          try {
            await html5QrCodeRef.current.stop();

            setIsScanning(false);
          } catch (error) {
            console.error(
              'Error stopping scanner:',
              error
            );
          }
        }
      };

    stopCameraOnEventChange();
  }, [selectedEventId]);

  // ============================================================
  // START QR SCANNER
  // ============================================================

  const startScanner = async () => {
    if (!selectedEventId) {
      alert(
        'Please select an event first!'
      );
      return;
    }

    if (!selectedSessionId) {
      alert(
        'No attendance session is currently selected.'
      );
      return;
    }

    if (!activeSession) {
      alert(
        'The selected session could not be loaded.'
      );
      return;
    }

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current =
          new Html5Qrcode(
            'reader'
          );
      }

      if (
        html5QrCodeRef.current.isScanning
      ) {
        await html5QrCodeRef.current.stop();
      }

      setScanResult(null);

      processingScanRef.current =
        false;

      await html5QrCodeRef.current.start(
        {
          facingMode:
            'environment',
        },
        {
          fps: 10,
          qrbox: {
            width: 220,
            height: 220,
          },
        },
        onScanSuccess,
        onScanFailure
      );

      setIsScanning(true);
    } catch (error: any) {
      console.error(
        'Camera start error:',
        error
      );

      setIsScanning(false);

      setScanResult({
        success: false,
        message:
          error?.message ||
          'Unable to start camera. Please allow camera access.',
      });
    }
  };

  // ============================================================
  // STOP QR SCANNER
  // ============================================================

  const stopScanner = async () => {
    try {
      if (
        html5QrCodeRef.current &&
        html5QrCodeRef.current.isScanning
      ) {
        await html5QrCodeRef.current.stop();

        setIsScanning(false);
      }
    } catch (error) {
      console.error(
        'Error stopping scanner:',
        error
      );

      setIsScanning(false);
    }
  };

  // ============================================================
  // CLEANUP CAMERA
  // ============================================================

  useEffect(() => {
    return () => {
      if (
        html5QrCodeRef.current &&
        html5QrCodeRef.current.isScanning
      ) {
        html5QrCodeRef.current
          .stop()
          .catch((error) =>
            console.error(
              'Scanner cleanup error:',
              error
            )
          );
      }
    };
  }, []);

  // ============================================================
  // CREATE LOCAL DATE
  //
  // Used for session checkout windows.
  // ============================================================

  const formatTime = (date: Date): string => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      return '--';
    }

    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatTimeValue = (timeString: string | null | undefined): string => {
    if (!timeString) return '--:--';

    const parts = String(timeString).split(':').map(Number);
    const hour = parts[0];
    const minute = parts[1];

    if (
      !Number.isFinite(hour) ||
      !Number.isFinite(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return '--:--';
    }

    const date = new Date();
    date.setHours(hour, minute, 0, 0);

    return formatTime(date);
  };
const formatEventDate = (
  dateString: string | null | undefined
): string => {
  if (!dateString) return 'No date';

  const value = String(dateString).trim();

  // ------------------------------------------------------------
  // CASE 1: Supabase DATE value
  // Example: 2026-08-20
  // ------------------------------------------------------------
  const dateOnlyMatch = value.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);

    const date = new Date(
      year,
      month - 1,
      day
    );

    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return 'Invalid Date';
    }

    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  // ------------------------------------------------------------
  // CASE 2: ISO timestamp
  // Example:
  // 2026-08-20T00:00:00.000Z
  // ------------------------------------------------------------
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    console.error(
      'INVALID EVENT DATE:',
      dateString
    );

    return 'Invalid Date';
  }

  return parsedDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

  const createLocalDate = (
    dateString: string,
    timeString: string
  ): Date => {
    const [
      year,
      month,
      day,
    ] = dateString
      .split('-')
      .map(Number);

    const [
      hour,
      minute,
      second,
    ] = timeString
      .split(':')
      .map(Number);

    return new Date(
      year,
      month - 1,
      day,
      hour || 0,
      minute || 0,
      second || 0,
      0
    );
  };

  // ============================================================
  // ATTENDANCE ACTION WINDOWS
  //
  // CHECK-IN is ONLY allowed during attendance_start -> attendance_end.
  // CHECK-OUT is ONLY allowed during checkout_start -> checkout_end.
  // checkout_end is the FINAL CUTOFF for this session.
  //
  // There is NO late check-in period between the two windows.
  // ============================================================

  type SessionActionResult = {
    allowed: boolean;
    status: 'PRESENT' | 'LATE' | 'CLOSED' | 'EARLY';
    label: string;
    badgeStyle: string;
  };

  const getSessionActionStatus = (
    session: any,
    action: 'CHECK_IN' | 'CHECK_OUT' = 'CHECK_IN'
  ): SessionActionResult => {
    if (!session?.session_date) {
      return {
        allowed: false,
        status: 'CLOSED',
        label: 'Invalid Session Date',
        badgeStyle:
          'bg-rose-500/10 text-rose-400 border-rose-500/20',
      };
    }

    const attendanceStartRaw =
      session.attendance_start || session.start_time;

    const attendanceEndRaw =
      session.attendance_end || session.end_time;

    const checkoutStartRaw =
      session.checkout_start ??
      session.check_out_start;

    const checkoutEndRaw =
      session.checkout_end ??
      session.check_out_end ??
      session.cutoff_time ??
      attendanceEndRaw;

    if (
      !attendanceStartRaw ||
      !attendanceEndRaw ||
      !checkoutStartRaw ||
      !checkoutEndRaw
    ) {
      console.error(
        'Session is missing required attendance/check-out times:',
        session
      );

      return {
        allowed: false,
        status: 'CLOSED',
        label: 'Invalid Session Time',
        badgeStyle:
          'bg-rose-500/10 text-rose-400 border-rose-500/20',
      };
    }

    const attendanceStart = createLocalDate(
      session.session_date,
      String(attendanceStartRaw).slice(0, 8)
    );

    const attendanceEnd = createLocalDate(
      session.session_date,
      String(attendanceEndRaw).slice(0, 8)
    );

    const checkoutStart = createLocalDate(
      session.session_date,
      String(checkoutStartRaw).slice(0, 8)
    );

    const checkoutEnd = createLocalDate(
      session.session_date,
      String(checkoutEndRaw).slice(0, 8)
    );

    const now = new Date();

    console.log('SESSION ACTION CHECK:', {
      session: session.session_name,
      action,
      now: now.toString(),
      attendanceStart: attendanceStart.toString(),
      attendanceEnd: attendanceEnd.toString(),
      checkoutStart: checkoutStart.toString(),
      checkoutEnd: checkoutEnd.toString(),
    });

    if (action === 'CHECK_IN') {
      if (now < attendanceStart) {
        return {
          allowed: false,
          status: 'EARLY',
          label: `Check-in opens at ${formatTime(attendanceStart)}`,
          badgeStyle:
            'bg-slate-500/10 text-slate-400 border-slate-500/20',
        };
      }

      if (now >= attendanceStart && now <= attendanceEnd) {
        return {
          allowed: true,
          status: 'PRESENT',
          label: 'Check-in Open',
          badgeStyle:
            'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        };
      }

      if (now < checkoutStart) {
        return {
          allowed: false,
          status: 'CLOSED',
          label: `Check-in closed. Check-out opens at ${formatTime(checkoutStart)}`,
          badgeStyle:
            'bg-amber-500/10 text-amber-400 border-amber-500/20',
        };
      }

      if (now <= checkoutEnd) {
        return {
          allowed: false,
          status: 'CLOSED',
          label: `Check-in closed. Check-out is open until ${formatTime(checkoutEnd)}`,
          badgeStyle:
            'bg-amber-500/10 text-amber-400 border-amber-500/20',
        };
      }

      return {
        allowed: false,
        status: 'CLOSED',
        label: `Attendance closed. Final cutoff was ${formatTime(checkoutEnd)}`,
        badgeStyle:
          'bg-rose-500/10 text-rose-400 border-rose-500/20',
      };
    }

    if (now < checkoutStart) {
      return {
        allowed: false,
        status: 'EARLY',
        label: `Check-out opens at ${formatTime(checkoutStart)}`,
        badgeStyle:
          'bg-slate-500/10 text-slate-400 border-slate-500/20',
      };
    }

    if (now <= checkoutEnd) {
      return {
        allowed: true,
        status: 'PRESENT',
        label: 'Check-out Open',
        badgeStyle:
          'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      };
    }

    return {
      allowed: false,
      status: 'CLOSED',
      label: `Attendance closed. Final cutoff was ${formatTime(checkoutEnd)}`,
      badgeStyle:
        'bg-rose-500/10 text-rose-400 border-rose-500/20',
    };
  };

  // ============================================================
  // FIND CURRENT SESSION
  //
  // FULL DAY events have separate Morning and Afternoon rows.
  // The scanner automatically switches to whichever session has
  // an open check-in or check-out window.
  // ============================================================

  const getCurrentSession = (
    sessionList: any[]
  ): any | null => {
    if (!sessionList?.length) {
      return null;
    }

    const now = new Date();

    // Build all sessions that are currently accepting an attendance action.
    // We deliberately do NOT fall back to an old session here. For a FULL DAY
    // event, using an old Morning session after its window has closed is what
    // can cause an Afternoon scan to be treated as a duplicate Morning scan.
    const activeSessions = sessionList
      .map((session) => {
        if (!session?.session_date) {
          return null;
        }

        const attendanceStartRaw =
          session.attendance_start || session.start_time;

        const attendanceEndRaw =
          session.attendance_end || session.end_time;

        const checkoutStartRaw =
          session.checkout_start ??
          session.check_out_start;

        const checkoutEndRaw =
          session.checkout_end ??
          session.check_out_end ??
          session.cutoff_time ??
          attendanceEndRaw;

        if (
          !attendanceStartRaw ||
          !attendanceEndRaw ||
          !checkoutStartRaw ||
          !checkoutEndRaw
        ) {
          return null;
        }

        const attendanceStart = createLocalDate(
          session.session_date,
          String(attendanceStartRaw).slice(0, 8)
        );

        const attendanceEnd = createLocalDate(
          session.session_date,
          String(attendanceEndRaw).slice(0, 8)
        );

        const checkoutStart = createLocalDate(
          session.session_date,
          String(checkoutStartRaw).slice(0, 8)
        );

        const checkoutEnd = createLocalDate(
          session.session_date,
          String(checkoutEndRaw).slice(0, 8)
        );

        const isCheckInOpen =
          now >= attendanceStart &&
          now <= attendanceEnd;

        const isCheckOutOpen =
          now >= checkoutStart &&
          now <= checkoutEnd;

        if (!isCheckInOpen && !isCheckOutOpen) {
          return null;
        }

        return {
          session,
          attendanceStart,
          attendanceEnd,
          checkoutStart,
          checkoutEnd,
          isCheckInOpen,
          isCheckOutOpen,
        };
      })
      .filter(Boolean) as any[];

    if (!activeSessions.length) {
      return null;
    }

    // If windows ever overlap, prefer the session that starts latest.
    // This prevents an older session from winning over the newer session.
    activeSessions.sort(
      (a, b) =>
        b.attendanceStart.getTime() -
        a.attendanceStart.getTime()
    );

    const selected = activeSessions[0];

    console.log(
      'CURRENT SESSION RESOLVED:',
      selected.session.session_name,
      selected.session.id,
      {
        now: now.toString(),
        checkInOpen: selected.isCheckInOpen,
        checkOutOpen: selected.isCheckOutOpen,
      }
    );

    return selected.session;
  };

  // ============================================================
  // GET CHECKOUT WINDOW
  //
  // Priority:
  //
  // 1. Explicit checkout_start / checkout_end
  // 2. Legacy check_out_start / check_out_end
  // 3. attendance_end → cutoff_time
  //
  // This allows the system to work with your existing rows
  // while supporting explicit checkout windows later.
  // ============================================================

const getCheckoutWindow = (
  session: any
) => {
  if (!session) {
    return null;
  }

  const sessionDate = session.session_date;

  if (!sessionDate) {
    return null;
  }

  // ============================================================
  // IMPORTANT:
  // The actual database columns are:
  //
  // checkout_start
  // checkout_end
  //
  // NOT:
  // check_out_start
  // check_out_end
  // ============================================================

  const checkoutStart =
    session.checkout_start;

  const checkoutEnd =
    session.checkout_end;

  // ============================================================
  // EXPLICIT CHECKOUT WINDOW
  // ============================================================

  if (
    checkoutStart &&
    checkoutEnd
  ) {
    const startTime = String(
      checkoutStart
    ).slice(0, 8);

    const endTime = String(
      checkoutEnd
    ).slice(0, 8);

    return {
      start: createLocalDate(
        sessionDate,
        startTime
      ),

      end: createLocalDate(
        sessionDate,
        endTime
      ),
    };
  }

  // ============================================================
  // FALLBACK FOR OLD SESSIONS
  //
  // Only used when checkout_start / checkout_end
  // do not exist.
  // ============================================================

const fallbackStart =
   session.checkout_start ??
   session.check_out_start ??
   session.attendance_end ??
   session.end_time;

 const fallbackEnd =
   session.checkout_end ??
   session.check_out_end ??
   session.cutoff_time ??
   session.attendance_end ??
   session.end_time;

  if (
    fallbackStart &&
    fallbackEnd
  ) {
    return {
      start: createLocalDate(
        sessionDate,
        String(
          fallbackStart
        ).slice(0, 8)
      ),

      end: createLocalDate(
        sessionDate,
        String(
          fallbackEnd
        ).slice(0, 8)
      ),
    };
  }

  return null;
};

  // ============================================================
  // PROCESS ATTENDANCE
  //
  // First scan:
  //     CHECK-IN
  //
  // Second scan:
  //     CHECK-OUT
  // ============================================================

  // ============================================================
  // PROCESS ATTENDANCE
  //
  // IMPORTANT STATE MACHINE
  // ------------------------
  // The current time decides the action FIRST.
  //
  // CHECK-IN WINDOW:
  //   - no attendance row -> CREATE CHECK-IN
  //   - attendance row exists -> already checked in for this session
  //
  // CHECK-OUT WINDOW:
  //   - no attendance row -> REJECT (student missed check-in)
  //   - row exists, no checkout -> UPDATE CHECK-OUT
  //   - row already has checkout -> already checked out
  //
  // This is what keeps Morning and Afternoon completely independent.
  // ============================================================

  const processAttendance = async (userId: string) => {
    const cleanUserId = userId.trim();

    if (!cleanUserId) {
      setScanResult({
        success: false,
        message: 'Please provide a valid Student UUID.',
      });
      return;
    }

    const eventId =
      selectedEventIdRef.current || selectedEventId;

    if (!eventId) {
      setScanResult({
        success: false,
        message: 'Please select an event first!',
      });
      return;
    }

    // Always resolve the session from the CURRENT TIME at scan time.
    // Never reuse a stale Morning session during Afternoon.
    const session = getCurrentSession(sessionsRef.current);

    if (!session) {
      setScanResult({
        success: false,
        message:
          'No attendance session is currently open. Please scan during an active check-in or check-out window.',
      });
      return;
    }

    const now = new Date();

    const attendanceStartRaw =
      session.attendance_start || session.start_time;
    const attendanceEndRaw =
      session.attendance_end || session.end_time;
    const checkoutStartRaw =
      session.checkout_start ?? session.check_out_start;
    const checkoutEndRaw =
      session.checkout_end ??
      session.check_out_end ??
      session.cutoff_time ??
      attendanceEndRaw;

    if (
      !attendanceStartRaw ||
      !attendanceEndRaw ||
      !checkoutStartRaw ||
      !checkoutEndRaw
    ) {
      setScanResult({
        success: false,
        message: `${session.session_name || 'This session'} has incomplete attendance windows.`,
      });
      return;
    }

    const attendanceStart = createLocalDate(
      session.session_date,
      String(attendanceStartRaw).slice(0, 8)
    );
    const attendanceEnd = createLocalDate(
      session.session_date,
      String(attendanceEndRaw).slice(0, 8)
    );
    const checkoutStart = createLocalDate(
      session.session_date,
      String(checkoutStartRaw).slice(0, 8)
    );
    const checkoutEnd = createLocalDate(
      session.session_date,
      String(checkoutEndRaw).slice(0, 8)
    );

    const inCheckInWindow =
      now >= attendanceStart && now <= attendanceEnd;
    const inCheckOutWindow =
      now >= checkoutStart && now <= checkoutEnd;

    // There should normally never be overlapping windows.
    // If there is, CHECK-OUT gets priority only when the student already
    // has an attendance record. Otherwise CHECK-IN remains the action.
    let action: 'CHECK_IN' | 'CHECK_OUT';

    if (inCheckInWindow) {
      action = 'CHECK_IN';
    } else if (inCheckOutWindow) {
      action = 'CHECK_OUT';
    } else {
      setScanResult({
        success: false,
        message:
          `No attendance action is available for ${session.session_name || 'this session'} at ${formatTime(now)}.`,
        action: 'CHECK_IN',
      });
      return;
    }

    console.log('================ ATTENDANCE STATE ================');
    console.log({
      eventId,
      sessionId: session.id,
      sessionName: session.session_name,
      now: now.toString(),
      action,
      attendanceStart: attendanceStart.toString(),
      attendanceEnd: attendanceEnd.toString(),
      checkoutStart: checkoutStart.toString(),
      checkoutEnd: checkoutEnd.toString(),
    });
    console.log('====================================================');

    // Keep UI synchronized with the session actually used for this scan.
    activeSessionRef.current = session;
    if (selectedSessionId !== session.id) {
      setSelectedSessionId(session.id);
      setActiveSession(session);
    }

    setLoading(true);

    try {
      // ========================================================
      // 1. FIND STUDENT
      // ========================================================

      const {
        data: userData,
        error: userError,
      } = await supabase
        .from('users')
        .select('*')
        .eq('id', cleanUserId)
        .single();

      if (userError || !userData) {
        throw new Error(
          'Invalid QR Code: Student account not found.'
        );
      }

      const studentName =
        userData.full_name ||
        userData.name ||
        'Student';

      // ========================================================
      // 2. FIND ATTENDANCE FOR THIS EXACT SESSION
      //
      // NEVER query only event_id + user_id.
      // Morning and Afternoon are separate records.
      // ========================================================

      const {
        data: existingAttendance,
        error: existingAttendanceError,
      } = await supabase
        .from('attendances')
        .select('*')
        .eq('event_id', eventId)
        .eq('session_id', session.id)
        .eq('user_id', cleanUserId)
        .maybeSingle();

      if (existingAttendanceError) {
        console.error(
          'Attendance lookup error:',
          existingAttendanceError
        );
        throw existingAttendanceError;
      }

      // ========================================================
      // 3. CHECK-IN ACTION
      // ========================================================

      if (action === 'CHECK_IN') {
        const checkInStatus = getSessionActionStatus(
          session,
          'CHECK_IN'
        );

        if (!checkInStatus.allowed) {
          setScanResult({
            success: false,
            message:
              `Check-in Rejected: ${checkInStatus.label}`,
            user: userData,
            status: checkInStatus.status,
            action: 'CHECK_IN',
          });
          return;
        }

        // A record already exists for THIS session.
        // Morning's record does not reach this query when Afternoon is active.
        if (existingAttendance) {
          if (existingAttendance.check_out_time) {
            setScanResult({
              success: false,
              message:
                `${studentName} has already completed ${session.session_name || 'this session'}.`,
              user: userData,
              action: 'CHECK_IN',
            });
          } else {
            setScanResult({
              success: false,
              message:
                `${studentName} is already checked in for ${session.session_name || 'this session'}.`,
              user: userData,
              action: 'CHECK_IN',
            });
          }
          return;
        }

        const finalStatus = String(
          checkInStatus.status || 'PRESENT'
        ).toLowerCase();

        // ======================================================
        // CREATE NEW ATTENDANCE FOR THIS SESSION
        // ======================================================

        const { error: insertError } = await supabase
          .from('attendances')
          .insert([
            {
              event_id: eventId,
              session_id: session.id,
              user_id: cleanUserId,
              check_in_time: now.toISOString(),
              status: finalStatus,
              cert_sent: false,
            },
          ]);

        if (insertError) {
          console.error(
            'CHECK-IN INSERT ERROR:',
            insertError
          );

          if (insertError.code === '23505') {
            // If the exact session row now exists, this is simply a
            // concurrent duplicate scan. Otherwise the database still
            // contains an incorrect broader UNIQUE rule.
            const {
              data: duplicateForSession,
            } = await supabase
              .from('attendances')
              .select('id, session_id, check_in_time, check_out_time')
              .eq('event_id', eventId)
              .eq('session_id', session.id)
              .eq('user_id', cleanUserId)
              .maybeSingle();

            if (duplicateForSession) {
              setScanResult({
                success: false,
                message:
                  `${studentName} is already checked in for ${session.session_name || 'this session'}.`,
                user: userData,
                action: 'CHECK_IN',
              });
              return;
            }

            setScanResult({
              success: false,
              message:
                'The database is still blocking multiple sessions. Verify that attendances has UNIQUE(event_id, user_id, session_id) and no UNIQUE(event_id, user_id) rule remains.',
              user: userData,
              action: 'CHECK_IN',
            });
            return;
          }

          throw insertError;
        }

        setScanResult({
          success: true,
          message:
            `Verified ${session.session_name || 'session'} check-in for ${studentName}! (${checkInStatus.status === 'LATE' ? 'LATE' : 'ON TIME'})`,
          user: userData,
          status: checkInStatus.status,
          action: 'CHECK_IN',
        });

        return;
      }

      // ========================================================
      // 4. CHECK-OUT ACTION
      // ========================================================

      const checkOutStatus = getSessionActionStatus(
        session,
        'CHECK_OUT'
      );

      if (!checkOutStatus.allowed) {
        setScanResult({
          success: false,
          message:
            `Check-out Rejected: ${checkOutStatus.label}`,
          user: userData,
          status: checkOutStatus.status,
          action: 'CHECK_OUT',
        });
        return;
      }

      // IMPORTANT:
      // No attendance record for THIS session means the student missed
      // this session's check-in. Do NOT create a late check-in and do NOT
      // touch Morning's record.
      if (!existingAttendance) {
        setScanResult({
          success: false,
          message:
            `${studentName} did not check in for ${session.session_name || 'this session'}. Check-out is unavailable.`,
          user: userData,
          action: 'CHECK_OUT',
        });
        return;
      }

      if (existingAttendance.check_out_time) {
        setScanResult({
          success: false,
          message:
            `${studentName} has already checked out for ${session.session_name || 'this session'}.`,
          user: userData,
          action: 'CHECK_OUT',
        });
        return;
      }

      if (!existingAttendance.id) {
        throw new Error(
          'Check-out failed: attendance record ID is missing.'
        );
      }

      const { data: updatedAttendance, error: checkoutError } =
        await supabase
          .from('attendances')
          .update({
            check_out_time: now.toISOString(),
          })
          .eq('id', existingAttendance.id)
          .select('*');

      if (checkoutError) {
        console.error(
          'CHECK-OUT UPDATE ERROR:',
          checkoutError
        );
        throw checkoutError;
      }

      if (!updatedAttendance?.length) {
        throw new Error(
          'Check-out failed: no attendance row was updated.'
        );
      }

      console.log(
        'CHECK-OUT SAVED:',
        updatedAttendance[0]
      );

      setScanResult({
        success: true,
        message:
          `Verified ${session.session_name || 'session'} check-out for ${studentName}!`,
        user: userData,
        status: 'PRESENT',
        action: 'CHECK_OUT',
      });
    } catch (error: any) {
      console.error(
        'Attendance processing error:',
        error
      );

      setScanResult({
        success: false,
        message:
          error?.message ||
          'Failed to process attendance.',
      });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // QR SCAN SUCCESS
  // ============================================================

  const onScanSuccess =
    async (
      decodedText: string
    ) => {
      if (
        processingScanRef.current ||
        loading
      ) {
        return;
      }

      processingScanRef.current =
        true;

      try {
        if (
          html5QrCodeRef.current &&
          html5QrCodeRef.current.isScanning
        ) {
          await html5QrCodeRef.current.stop();

          setIsScanning(false);
        }

        await processAttendance(
          decodedText
        );
      } finally {
        processingScanRef.current =
          false;
      }
    };

  // ============================================================
  // QR SCAN FAILURE
  // ============================================================

  const onScanFailure =
    () => {
      // Silent failure while camera
      // searches for a QR code.
    };

  // ============================================================
  // MANUAL CHECK-IN / CHECK-OUT
  // ============================================================

  const handleManualSubmit =
    (e: React.FormEvent) => {
      e.preventDefault();

      if (
        !manualId.trim()
      ) {
        setScanResult({
          success: false,
          message:
            'Please enter a Student User UUID.',
        });

        return;
      }

      processAttendance(
        manualId.trim()
      );

      setManualId('');
    };

  // ============================================================
  // CURRENT SESSION ATTENDANCE STATUS
  // ============================================================

  const currentSessionCheck =
    activeSession
      ? getSessionActionStatus(
          activeSession,
          'CHECK_IN'
        )
      : null;

  // ============================================================
  // CURRENT CHECKOUT WINDOW
  // ============================================================

  const checkoutWindow =
    activeSession
      ? getCheckoutWindow(
          activeSession
        )
      : null;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 md:p-10">

      <div className="max-w-xl mx-auto space-y-6">

        {/* ======================================================
            HEADER
        ======================================================= */}

        <div className="flex items-center justify-between">

          <Link
            href="/admin/dashboard"
            className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1.5 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>

        </div>

        {/* ======================================================
            PAGE TITLE
        ======================================================= */}

        <div className="text-center">

          <h1 className="text-2xl font-bold text-indigo-400">
            Event Attendance Scanner
          </h1>

          <p className="text-slate-400 text-xs mt-1">
            Scan student QR codes for check-in and check-out
          </p>

        </div>

        {/* ======================================================
            EVENT + SESSION SELECTORS
        ======================================================= */}

        <div className="bg-slate-800 border border-slate-700 p-4 rounded-xl space-y-4">

          {/* EVENT */}

          <div>

            <label className="block text-xs uppercase tracking-wider text-slate-400 mb-2 font-semibold">
              Select Active Event:
            </label>

            <select
              value={
                selectedEventId
              }
              onChange={(e) => {
                selectedEventIdRef.current =
                  e.target.value;

                setSelectedEventId(
                  e.target.value
                );

                setScanResult(
                  null
                );
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm"
            >

              {events.length >
              0 ? (
                events.map(
                  (event) => (
                    <option
                      key={
                        event.id
                      }
                      value={
                        event.id
                      }
                    >
                      {
                        event.title
                      }{' '}
                      (
                      {
                        formatEventDate(event.event_date)
                      }
                      )
                    </option>
                  )
                )
              ) : (
                <option value="">
                  No events found
                </option>
              )}

            </select>

          </div>

          {/* SESSION */}

          <div>

            <div className="flex items-center justify-between mb-2">

              <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold">
                Select Active Session:
              </label>

              {currentSessionCheck && (
                <span
                  className={`text-[10px] px-2.5 py-0.5 rounded-full border font-medium ${currentSessionCheck.badgeStyle}`}
                >
                  {
                    currentSessionCheck.label
                  }
                </span>
              )}

            </div>

            <select
              value={
                selectedSessionId
              }
              onChange={(e) =>
                handleSessionChange(
                  e.target.value
                )
              }
              disabled={
                sessions.length ===
                0
              }
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 text-sm disabled:opacity-50"
            >

              {sessions.length >
              0 ? (
                sessions.map(
                  (session) => (
                    <option
                      key={
                        session.id
                      }
                      value={
                        session.id
                      }
                    >

                      {
                        session.session_name ||
                        session.title ||
                        'Session'
                      }

                      {' ('}

                      {formatTimeValue(session.attendance_start)}

                      {' - '}

                      {formatTimeValue(session.attendance_end)}

                      {')'}

                    </option>
                  )
                )
              ) : (
                <option value="">
                  No sessions found for this event
                </option>
              )}

            </select>

          </div>

        </div>

        {/* ======================================================
            SESSION WINDOWS
        ======================================================= */}

        {activeSession && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            {/* CHECK-IN WINDOW */}

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">

              <div className="flex items-center gap-2 mb-2">

                <LogIn className="w-4 h-4 text-indigo-400" />

                <p className="text-xs font-bold uppercase text-slate-400">
                  Check-In
                </p>

              </div>

              <p className="text-sm font-bold text-white">

                {formatTimeValue(activeSession.attendance_start)}

                {' - '}

                {formatTimeValue(activeSession.attendance_end)}

              </p>

              {checkoutWindow && (
                <p className="text-[11px] text-amber-400 mt-1">

                  Final cutoff:{' '}

                  {formatTime(checkoutWindow.end)}

                </p>
              )}

            </div>

            {/* CHECK-OUT WINDOW */}

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">

              <div className="flex items-center gap-2 mb-2">

                <LogOut className="w-4 h-4 text-indigo-400" />

                <p className="text-xs font-bold uppercase text-slate-400">
                  Check-Out
                </p>

              </div>

              {checkoutWindow ? (
                <>
                  <p className="text-sm font-bold text-white">

                    {formatTime(checkoutWindow.start)}

                    {' - '}

                    {formatTime(checkoutWindow.end)}

                  </p>

                  <p className="text-[11px] text-emerald-400 mt-1">
                    Checkout available during this window
                  </p>
                </>
              ) : (
                <p className="text-xs text-rose-400">
                  Checkout window not configured
                </p>
              )}

            </div>

          </div>
        )}

        {/* ======================================================
            SCAN RESULT
        ======================================================= */}

        {scanResult && (

          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              scanResult.success
                ? scanResult.status ===
                  'LATE'
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >

            {scanResult.success ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            )}

            <div>

              <p className="font-bold text-sm">
                {
                  scanResult.message
                }
              </p>

              {scanResult.action && (
                <p className="text-[10px] uppercase font-bold mt-1 opacity-70">
                  {scanResult.action ===
                  'CHECK_IN'
                    ? 'Check-In'
                    : 'Check-Out'}
                </p>
              )}

              {scanResult.user && (
                <p className="text-xs mt-1 text-slate-300 font-mono">

                  Student ID:{' '}

                  {
                    scanResult.user.student_number ||
                    scanResult.user.student_id ||
                    'N/A'
                  }

                </p>
              )}

            </div>

          </div>

        )}

        {/* ======================================================
            CAMERA SCANNER
        ======================================================= */}

        <div className="bg-slate-800 border border-slate-700 p-6 rounded-2xl text-center space-y-4 shadow-xl">

          <div className="relative w-full aspect-square max-w-sm mx-auto bg-slate-900 rounded-xl overflow-hidden border border-slate-700 flex items-center justify-center">

            <div
              id="reader"
              className="w-full h-full [&>video]:object-cover [&>video]:w-full [&>video]:h-full"
            />

            {!isScanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-slate-400 p-4">

                <Camera className="w-10 h-10 mb-2 text-slate-500" />

                <p className="text-xs">
                  Camera is currently stopped
                </p>

              </div>
            )}

          </div>

          {/* CAMERA BUTTONS */}

          <div className="flex gap-2 justify-center">

            {!isScanning ? (

              <button
                onClick={
                  startScanner
                }
                disabled={
                  !selectedEventId ||
                  !selectedSessionId ||
                  loading
                }
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-5 py-2.5 rounded-xl transition inline-flex items-center gap-2 shadow-lg shadow-indigo-600/20"
              >

                <Camera className="w-4 h-4" />

                Start Scanner

              </button>

            ) : (

              <button
                onClick={
                  stopScanner
                }
                className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition inline-flex items-center gap-2"
              >

                <CameraOff className="w-4 h-4" />

                Stop Camera

              </button>

            )}

          </div>

        </div>

        {/* ======================================================
            MANUAL SCAN
        ======================================================= */}

        <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl">

          <h3 className="text-xs font-semibold uppercase text-slate-400 mb-2">
            Manual Check-In / Check-Out
          </h3>

          <p className="text-[11px] text-slate-500 mb-3">
            The scanner uses the current Morning or Afternoon session.
            A new student scan performs check-in only during the check-in
            window. An existing check-in can be checked out only during
            that session's checkout window.
          </p>

          <form
            onSubmit={
              handleManualSubmit
            }
            className="flex gap-2"
          >

            <input
              type="text"
              placeholder="Student User UUID..."
              value={
                manualId
              }
              onChange={(e) =>
                setManualId(
                  e.target.value
                )
              }
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
            />

            <button
              type="submit"
              disabled={
                loading ||
                !selectedEventId ||
                !selectedSessionId
              }
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2 rounded-lg transition"
            >

              {loading
                ? 'Processing...'
                : 'Process'}

            </button>

          </form>

        </div>

        {/* ======================================================
            CURRENT SESSION INFORMATION
        ======================================================= */}

        {activeSession && (

          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">

            <div className="flex items-center gap-2 mb-3">

              <Clock className="w-4 h-4 text-indigo-400" />

              <h3 className="text-sm font-bold text-white">
                Current Session
              </h3>

            </div>

            <div className="grid grid-cols-2 gap-3">

              <div className="bg-slate-900 rounded-lg p-3">

                <p className="text-[10px] uppercase text-slate-500">
                  Session
                </p>

                <p className="text-xs font-semibold text-white mt-1">
                  {
                    activeSession.session_name ||
                    activeSession.title ||
                    'Unnamed Session'
                  }
                </p>

              </div>

              <div className="bg-slate-900 rounded-lg p-3">

                <p className="text-[10px] uppercase text-slate-500">
                  Attendance Status
                </p>

                {currentSessionCheck && (
                  <p className="text-xs font-semibold text-indigo-400 mt-1">
                    {
                      currentSessionCheck.label
                    }
                  </p>
                )}

              </div>

              <div className="bg-slate-900 rounded-lg p-3">

                <p className="text-[10px] uppercase text-slate-500">
                  Attendance Start
                </p>

                <p className="text-xs font-semibold text-white mt-1">

                  {formatTimeValue(activeSession.attendance_start)}

                </p>

              </div>

              <div className="bg-slate-900 rounded-lg p-3">

                <p className="text-[10px] uppercase text-slate-500">
                  Attendance End
                </p>

                <p className="text-xs font-semibold text-white mt-1">

                  {formatTimeValue(activeSession.attendance_end)}

                </p>

              </div>

              <div className="bg-slate-900 rounded-lg p-3">

                <p className="text-[10px] uppercase text-slate-500">
                  Final Cutoff
                </p>

                <p className="text-xs font-semibold text-amber-400 mt-1">

                  {checkoutWindow
                    ? formatTime(checkoutWindow.end)
                    : '--:--'}

                </p>

              </div>

              <div className="bg-slate-900 rounded-lg p-3">

                <p className="text-[10px] uppercase text-slate-500">
                  Checkout
                </p>

                {checkoutWindow ? (
                  <p className="text-xs font-semibold text-emerald-400 mt-1">

                    {formatTime(checkoutWindow.start)}

                    {' - '}

                    {formatTime(checkoutWindow.end)}

                  </p>
                ) : (
                  <p className="text-xs font-semibold text-rose-400 mt-1">
                    Not configured
                  </p>
                )}

              </div>

            </div>

          </div>

        )}

      </div>

    </div>
  );
}