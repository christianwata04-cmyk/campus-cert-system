export interface AttendanceSession {
  id: string;
  event_id: string;
  session_date: string;
  start_time?: string;
  end_time?: string;
  attendance_start?: string;
  attendance_end?: string;
  cutoff_time?: string;
  checkout_start?: string;
  checkout_end?: string;
}

export interface AttendanceCheckResult {
  allowed: boolean;
  status: 'PRESENT' | 'LATE' | 'CLOSED' | 'EARLY';
  label: string;
  badgeStyle: string;
}

function createLocalDate(dateString: string, timeString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  const [hour = 0, minute = 0, second = 0] = timeString
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
}

/**
 * Attendance windows are intentionally strict:
 *
 * CHECK_IN  = attendance_start -> attendance_end only
 * CHECK_OUT = checkout_start   -> checkout_end only
 * FINAL CUTOFF = checkout_end
 *
 * A student cannot check in during the checkout window, and cannot
 * check out before checkout_start. The old cutoff_time is retained
 * only for database compatibility and is NOT used as the final cutoff
 * when checkout_end exists.
 */
export function getAttendanceStatus(
  session: AttendanceSession,
  action: 'CHECK_IN' | 'CHECK_OUT' = 'CHECK_IN'
): AttendanceCheckResult {
  const now = new Date();

  if (!session.session_date) {
    console.error('Attendance session is missing session_date:', session);
    return {
      allowed: false,
      status: 'CLOSED',
      label: 'Invalid Session Date',
      badgeStyle: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    };
  }

  const attendanceStart = session.attendance_start || session.start_time;
  const attendanceEnd = session.attendance_end || session.end_time;
  const checkoutStart = session.checkout_start;
  const checkoutEnd = session.checkout_end;

  if (!attendanceStart || !attendanceEnd) {
    console.error('Attendance session is missing check-in times:', session);
    return {
      allowed: false,
      status: 'CLOSED',
      label: 'Invalid Check-in Time',
      badgeStyle: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    };
  }

  if (action === 'CHECK_OUT' && (!checkoutStart || !checkoutEnd)) {
    console.error('Attendance session is missing checkout times:', session);
    return {
      allowed: false,
      status: 'CLOSED',
      label: 'Checkout Time Not Configured',
      badgeStyle: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    };
  }

  const attendanceStartDate = createLocalDate(session.session_date, attendanceStart);
  const attendanceEndDate = createLocalDate(session.session_date, attendanceEnd);
  const checkoutStartDate = checkoutStart
    ? createLocalDate(session.session_date, checkoutStart)
    : null;
  const checkoutEndDate = checkoutEnd
    ? createLocalDate(session.session_date, checkoutEnd)
    : null;

  const finalCutoffDate =
    checkoutEndDate ||
    createLocalDate(session.session_date, session.cutoff_time || attendanceEnd);

  console.log('Attendance Status Check:', {
    action,
    now: now.toString(),
    attendanceStart: attendanceStartDate.toString(),
    attendanceEnd: attendanceEndDate.toString(),
    checkoutStart: checkoutStartDate?.toString() || null,
    checkoutEnd: checkoutEndDate?.toString() || null,
    finalCutoff: finalCutoffDate.toString(),
  });

  // ============================================================
  // CHECK-IN
  // ============================================================
  // ONLY attendance_start -> attendance_end is check-in.
  // There is NO late/grace check-in after attendance_end.
  // ============================================================
  if (action === 'CHECK_IN') {
    if (now < attendanceStartDate) {
      return {
        allowed: false,
        status: 'EARLY',
        label: 'Check-in Not Started',
        badgeStyle: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      };
    }

    if (now >= attendanceStartDate && now <= attendanceEndDate) {
      return {
        allowed: true,
        status: 'PRESENT',
        label: 'Check-in Open',
        badgeStyle: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      };
    }

    return {
      allowed: false,
      status: 'CLOSED',
      label:
        now <= finalCutoffDate
          ? 'Check-in Closed — Checkout Window Is Active'
          : 'Attendance Closed',
      badgeStyle: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    };
  }

  // ============================================================
  // CHECK-OUT
  // ============================================================
  // ONLY checkout_start -> checkout_end is check-out.
  // checkout_end is the final cutoff.
  // ============================================================
  if (action === 'CHECK_OUT') {
    if (!checkoutStartDate || !checkoutEndDate) {
      return {
        allowed: false,
        status: 'CLOSED',
        label: 'Checkout Time Not Configured',
        badgeStyle: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      };
    }

    if (now < checkoutStartDate) {
      return {
        allowed: false,
        status: 'EARLY',
        label: 'Check-out Not Started',
        badgeStyle: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
      };
    }

    if (now >= checkoutStartDate && now <= checkoutEndDate) {
      return {
        allowed: true,
        status: 'PRESENT',
        label: 'Check-out Open',
        badgeStyle: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      };
    }

    return {
      allowed: false,
      status: 'CLOSED',
      label: 'Check-out Closed',
      badgeStyle: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    };
  }

  return {
    allowed: false,
    status: 'CLOSED',
    label: 'Invalid Attendance Action',
    badgeStyle: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  };
}