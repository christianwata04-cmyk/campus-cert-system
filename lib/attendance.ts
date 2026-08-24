// lib/attendance.ts

export interface AttendanceSession {
  id: string;
  event_id: string;

  // Date of the actual attendance session.
  // Example: "2026-08-20"
  session_date: string;

  // Legacy/default time fields.
  // These are kept for compatibility with existing code.
  start_time?: string;
  end_time?: string;

  // Actual attendance window.
  // Example: "07:30:00"
  attendance_start?: string;
  attendance_end?: string;

  // Grace-period cutoff.
  // Example: "12:15:00"
  cutoff_time?: string;
}

export interface AttendanceCheckResult {
  allowed: boolean;

  status:
    | 'PRESENT'
    | 'LATE'
    | 'CLOSED'
    | 'EARLY';

  label: string;

  badgeStyle: string;
}

/**
 * Convert a database date + time into a local JavaScript Date.
 *
 * Example:
 *   date = "2026-08-20"
 *   time = "07:30:00"
 *
 * Result:
 *   August 20, 2026 at 7:30 AM
 *
 * We intentionally construct the Date using local date/time
 * components instead of UTC conversion so the attendance
 * schedule follows the user's local time.
 */
function createLocalDate(
  dateString: string,
  timeString: string
): Date {
  const [year, month, day] = dateString
    .split('-')
    .map(Number);

  const timeParts = timeString
    .split(':')
    .map(Number);

  const hour = timeParts[0] || 0;
  const minute = timeParts[1] || 0;
  const second = timeParts[2] || 0;

  return new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    second,
    0
  );
}

/**
 * Get the current attendance state for a session.
 *
 * States:
 *
 * EARLY
 *   Session has not started yet.
 *
 * PRESENT
 *   Student can check in normally.
 *
 * LATE
 *   Student can still check in, but is marked late.
 *
 * CLOSED
 *   Attendance is no longer accepted.
 */
export function getAttendanceStatus(
  session: AttendanceSession
): AttendanceCheckResult {
  const now = new Date();

  // ------------------------------------------------------------
  // Determine session date
  // ------------------------------------------------------------

  if (!session.session_date) {
    console.error(
      'Attendance session is missing session_date:',
      session
    );

    return {
      allowed: false,
      status: 'CLOSED',
      label: 'Invalid Session Date',
      badgeStyle:
        'bg-rose-500/10 text-rose-400 border-rose-500/20',
    };
  }

  // ------------------------------------------------------------
  // Determine attendance times
  // ------------------------------------------------------------

  const start =
    session.attendance_start ||
    session.start_time;

  const end =
    session.attendance_end ||
    session.end_time;

  // If no attendance start/end exists,
  // the session cannot be processed.
  if (!start || !end) {
    console.error(
      'Attendance session is missing attendance times:',
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

  // cutoff_time is optional in the database.
  // If it does not exist, use attendance_end as the cutoff.
  const cutoff: string =
    session.cutoff_time || end;

  // ------------------------------------------------------------
  // Build complete date + time values
  // ------------------------------------------------------------

  const sessionStart = createLocalDate(
    session.session_date,
    start
  );

  const sessionEnd = createLocalDate(
    session.session_date,
    end
  );

  const cutoffDate = createLocalDate(
    session.session_date,
    cutoff
  );

  // ------------------------------------------------------------
  // DEBUGGING
  // ------------------------------------------------------------

  console.log('Attendance Status Check:', {
    now: now.toString(),
    sessionDate: session.session_date,
    start: sessionStart.toString(),
    end: sessionEnd.toString(),
    cutoff: cutoffDate.toString(),
  });

  // ------------------------------------------------------------
  // 1. BEFORE SESSION
  // ------------------------------------------------------------

  if (now < sessionStart) {
    return {
      allowed: false,
      status: 'EARLY',
      label: 'Attendance Not Started',
      badgeStyle:
        'bg-slate-500/10 text-slate-400 border-slate-500/20',
    };
  }

  // ------------------------------------------------------------
  // 2. NORMAL ATTENDANCE WINDOW
  // ------------------------------------------------------------

  if (
    now >= sessionStart &&
    now < sessionEnd
  ) {
    return {
      allowed: true,
      status: 'PRESENT',
      label: 'Attendance Open',
      badgeStyle:
        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    };
  }

  // ------------------------------------------------------------
  // 3. LATE / GRACE PERIOD
  // ------------------------------------------------------------

  if (
    now >= sessionEnd &&
    now <= cutoffDate
  ) {
    return {
      allowed: true,
      status: 'LATE',
      label: 'Grace Period (Late)',
      badgeStyle:
        'bg-amber-500/10 text-amber-400 border-amber-500/20',
    };
  }

  // ------------------------------------------------------------
  // 4. AFTER CUTOFF
  // ------------------------------------------------------------

  return {
    allowed: false,
    status: 'CLOSED',
    label: 'Attendance Closed',
    badgeStyle:
      'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };
}