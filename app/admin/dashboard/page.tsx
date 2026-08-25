'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import {
  LogOut,
  Plus,
  Calendar,
  QrCode,
  ShieldCheck,
  Key,
  X,
  Check,
  MapPin,
  Clock,
  Users,
  UserCheck,
  Download,
  Trash2,
} from 'lucide-react';

type SessionType = 'full' | 'morning' | 'afternoon';

export default function AdminDashboard() {
  const router = useRouter();

  // ============================================================
  // STATE
  // ============================================================

  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // ============================================================
  // CHANGE PASSWORD
  // ============================================================

  const [isPasswordModalOpen, setIsPasswordModalOpen] =
    useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [passwordMsg, setPasswordMsg] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  // ============================================================
  // 12-HOUR TIME DISPLAY HELPER
  // Converts HH:MM or HH:MM:SS into 1:00 PM style text.
  // ============================================================

  const formatTime12Hour = (time: string): string => {
    if (!time) return '';

    const [hourText, minuteText] = time.split(':');
    const hour = Number(hourText);
    const minute = Number(minuteText || 0);

    if (Number.isNaN(hour) || Number.isNaN(minute)) {
      return time;
    }

    const suffix = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;

    return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
  };

  // ============================================================
  // CREATE EVENT
  // ============================================================

  const [isEventModalOpen, setIsEventModalOpen] =
    useState(false);

  const [eventTitle, setEventTitle] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDate, setEventDate] = useState('');

  const [checkInStart, setCheckInStart] = useState("07:30");
  const [checkInEnd, setCheckInEnd] = useState("09:00");

  const [checkOutStart, setCheckOutStart] = useState("11:30");
  const [checkOutEnd, setCheckOutEnd] = useState("12:30");
  // NEW: Session Type
  const [sessionType, setSessionType] =
    useState<SessionType>('full');

  // NEW: Prevent duplicate submissions
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [eventLoading, setEventLoading] = useState(false);

  const [eventMsg, setEventMsg] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  // ============================================================
  // ATTENDEES
  // ============================================================

  const [selectedEvent, setSelectedEvent] =
    useState<any | null>(null);

  const [attendees, setAttendees] = useState<any[]>([]);
  const [loadingAttendees, setLoadingAttendees] =
    useState(false);

  // ============================================================
  // EVENT SESSIONS
  // ============================================================

  const [selectedEventSessions, setSelectedEventSessions] =
    useState<any[]>([]);

  // ============================================================
  // AUTHORIZATION CHECK
  // ============================================================

  useEffect(() => {
    let mounted = true;

    const checkUserAuth = async () => {
      try {
        setCheckingAuth(true);

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          if (mounted) {
            router.replace('/login');
          }

          return;
        }

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profileError || !profile) {
          console.error(
            'Profile authorization error:',
            profileError
          );

          if (mounted) {
            router.replace('/login');
          }

          return;
        }

        const userRole = String(profile.role || '')
          .trim()
          .toLowerCase();

        const allowedRoles = ['admin', 'officer'];

        if (!allowedRoles.includes(userRole)) {
          console.warn(
            `Unauthorized dashboard access attempt by role: ${userRole}`
          );

          if (mounted) {
            router.replace('/student');
          }

          return;
        }

        if (mounted) {
          setCheckingAuth(false);
          await fetchEvents();
        }
      } catch (error) {
        console.error(
          'Authorization error:',
          error
        );

        if (mounted) {
          router.replace('/login');
        }
      }
    };

    checkUserAuth();

    return () => {
      mounted = false;
    };
  }, [router]);

  // ============================================================
  // FETCH EVENTS
  // ============================================================

  const fetchEvents = async () => {
    try {
      setLoading(true);

      const {
        data,
        error,
      } = await supabase
        .from('events')
        .select('*')
        .order('created_at', {
          ascending: false,
        });

      if (error) {
        throw error;
      }

      setEvents(data || []);
    } catch (err: any) {
      console.error(
        'Error fetching events:',
        err?.message || err
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // FETCH EVENT SESSIONS
  // ============================================================

  const fetchEventSessions = async (eventId: string) => {
    try {
      const {
        data,
        error,
      } = await supabase
        .from('dev_event_sessions')
        .select('*')
        .eq('event_id', eventId)
        .order('attendance_start', {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      setSelectedEventSessions(data || []);
    } catch (err) {
      console.error(
        'Error fetching event sessions:',
        err
      );

      setSelectedEventSessions([]);
    }
  };

  // ============================================================
  // FETCH ATTENDEES
  // ============================================================

  const fetchAttendees = async (event: any) => {
    try {
      setSelectedEvent(event);
      setLoadingAttendees(true);
      setAttendees([]);

      // ------------------------------------------------------------
      // FETCH THE EVENT'S SESSIONS FIRST.
      //
      // A Full Day event has multiple independent attendance rows.
      // A student is COMPLETED only when every required session has
      // both a check-in and a check-out.
      // ------------------------------------------------------------
      const {
        data: eventSessions,
        error: sessionError,
      } = await supabase
        .from('dev_event_sessions')
        .select('*')
        .eq('event_id', event.id)
        .order('attendance_start', {
          ascending: true,
        });

      if (sessionError) {
        throw sessionError;
      }

      const sessions = eventSessions || [];
      setSelectedEventSessions(sessions);

      // ------------------------------------------------------------
      // FETCH ALL ATTENDANCE ROWS FOR THIS EVENT.
      //
      // IMPORTANT:
      // Do NOT collapse rows by student before checking session_id.
      // One student can legitimately have:
      //
      //   Morning attendance row
      //   Afternoon attendance row
      //
      // Those rows must be evaluated independently.
      // ------------------------------------------------------------
      const {
        data: rawAttendance,
        error: attendanceError,
      } = await supabase
        .from('attendances')
        .select('*')
        .eq('event_id', event.id)
        .order('check_in_time', {
          ascending: false,
        });

      if (attendanceError) {
        throw attendanceError;
      }

      console.log(
        '================ ATTENDANCE FROM DATABASE ================'
      );

      console.table(
        (rawAttendance || []).map((item: any) => ({
          id: item.id,
          event_id: item.event_id,
          user_id: item.user_id,
          session_id: item.session_id,
          check_in_time: item.check_in_time,
          check_out_time:
            item.check_out_time ||
            item.checkout_time ||
            item.check_out_at ||
            null,
        }))
      );

      console.log(
        'EVENT SESSIONS:',
        sessions
      );

      console.log(
        '==========================================================='
      );

      if (!rawAttendance || rawAttendance.length === 0) {
        setAttendees([]);
        return [];
      }

      // ------------------------------------------------------------
      // FETCH STUDENT PROFILES.
      // ------------------------------------------------------------
      const userIds = Array.from(
        new Set(
          rawAttendance
            .map(
              (item: any) =>
                item.user_id || item.student_id
            )
            .filter(Boolean)
            .map(String)
        )
      );

      const userMap: Record<string, any> = {};

      if (userIds.length > 0) {
        const {
          data: usersData,
          error: usersError,
        } = await supabase
          .from('users')
          .select('*')
          .in('id', userIds);

        if (usersError) {
          console.error(
            'Error fetching users:',
            usersError
          );
        }

        if (usersData) {
          usersData.forEach((user: any) => {
            userMap[String(user.id)] = user;
          });
        }
      }

      // ------------------------------------------------------------
      // GROUP ATTENDANCE BY STUDENT.
      //
      // This preserves BOTH Morning and Afternoon rows.
      // ------------------------------------------------------------
      const attendanceByStudent =
        new Map<string, any[]>();

      rawAttendance.forEach((item: any) => {
        const studentKey = String(
          item.user_id ||
            item.student_id ||
            item.id
        );

        const existing =
          attendanceByStudent.get(studentKey) || [];

        existing.push({
          ...item,
          check_out_time:
            item.check_out_time ||
            item.checkout_time ||
            item.check_out_at ||
            null,
        });

        attendanceByStudent.set(
          studentKey,
          existing
        );
      });

      // ------------------------------------------------------------
      // BUILD ONE SUMMARY CARD PER STUDENT.
      //
      // STATUS RULES:
      //
      // COMPLETED
      //   Every required session has check-in + check-out.
      //
      // NO SIGN-OUT
      //   Student checked in to at least one required session,
      //   but that session has no checkout yet.
      //
      // INCOMPLETE
      //   A required session has already finished but the student
      //   has no attendance record for that session.
      //
      // PENDING
      //   A required session has not happened yet.
      // ------------------------------------------------------------
      const mappedData = Array.from(
        attendanceByStudent.entries()
      ).map(
        ([studentKey, studentRows]) => {
          const sessionAttendance =
            sessions.map((session: any) => {
              const sessionRows =
                studentRows.filter(
                  (row: any) =>
                    String(row.session_id || '') ===
                    String(session.id || '')
                );

              // Prefer the newest row for this exact session.
              const row =
                [...sessionRows].sort(
                  (a, b) =>
                    new Date(
                      b.check_in_time || 0
                    ).getTime() -
                    new Date(
                      a.check_in_time || 0
                    ).getTime()
                )[0] || null;

              const checkOut =
                row?.check_out_time || null;

              return {
                session_id: session.id,
                session_name:
                  session.session_name ||
                  session.title ||
                  'Session',
                session_date:
                  session.session_date ||
                  event.event_date ||
                  null,
                attendance_start:
                  session.attendance_start ||
                  null,
                attendance_end:
                  session.attendance_end ||
                  null,
                checkout_start:
                  session.checkout_start ||
                  null,
                checkout_end:
                  session.checkout_end ||
                  session.cutoff_time ||
                  null,
                attendance_id:
                  row?.id || null,
                check_in_time:
                  row?.check_in_time || null,
                check_out_time:
                  checkOut,
              };
            });

          // --------------------------------------------------------
          // LEGACY / SINGLE-SESSION FALLBACK
          //
          // If old data has no matching session_id but this event
          // contains exactly one session, use that row.
          // --------------------------------------------------------
          if (
            sessions.length === 1 &&
            sessionAttendance[0] &&
            !sessionAttendance[0].attendance_id &&
            studentRows.length > 0
          ) {
            const row =
              [...studentRows].sort(
                (a, b) =>
                  new Date(
                    b.check_in_time || 0
                  ).getTime() -
                  new Date(
                    a.check_in_time || 0
                  ).getTime()
              )[0];

            sessionAttendance[0] = {
              ...sessionAttendance[0],
              attendance_id:
                row.id || null,
              check_in_time:
                row.check_in_time || null,
              check_out_time:
                row.check_out_time || null,
            };
          }

          const hasAllSessionsCompleted =
            sessions.length > 0 &&
            sessionAttendance.every(
              (sessionRow: any) =>
                Boolean(
                  sessionRow.check_in_time
                ) &&
                Boolean(
                  sessionRow.check_out_time
                )
            );

          const hasNoSignOut =
            sessionAttendance.some(
              (sessionRow: any) =>
                Boolean(
                  sessionRow.check_in_time
                ) &&
                !sessionRow.check_out_time
            );

          const isSessionFinished = (
            sessionRow: any
          ) => {
            const endTime =
              sessionRow.checkout_end ||
              sessionRow.attendance_end;

            if (
              !sessionRow.session_date ||
              !endTime
            ) {
              return false;
            }

            const dateText = String(
              sessionRow.session_date
            ).slice(0, 10);

            const timeText = String(
              endTime
            ).slice(0, 8);

            const sessionEnd = new Date(
              `${dateText}T${timeText}`
            );

            return (
              !Number.isNaN(
                sessionEnd.getTime()
              ) &&
              new Date() >= sessionEnd
            );
          };

          const hasFinishedMissingSession =
            sessionAttendance.some(
              (sessionRow: any) =>
                !sessionRow.check_in_time &&
                isSessionFinished(sessionRow)
            );

          let attendanceStatus =
            'PENDING';

          if (
            hasAllSessionsCompleted
          ) {
            attendanceStatus =
              'COMPLETED';
          } else if (
            hasNoSignOut
          ) {
            attendanceStatus =
              'NO SIGN-OUT';
          } else if (
            hasFinishedMissingSession
          ) {
            attendanceStatus =
              'INCOMPLETE';
          }

          const latestCheckIn =
            studentRows
              .filter(
                (row: any) =>
                  row.check_in_time
              )
              .sort(
                (a, b) =>
                  new Date(
                    b.check_in_time
                  ).getTime() -
                  new Date(
                    a.check_in_time
                  ).getTime()
              )[0]?.check_in_time ||
            null;

          const latestCheckOut =
            studentRows
              .filter(
                (row: any) =>
                  row.check_out_time
              )
              .sort(
                (a, b) =>
                  new Date(
                    b.check_out_time
                  ).getTime() -
                  new Date(
                    a.check_out_time
                  ).getTime()
              )[0]?.check_out_time ||
            null;

          return {
            id:
              `student-${studentKey}`,
            user_id:
              studentRows[0].user_id ||
              studentRows[0].student_id ||
              studentKey,
            profiles:
              userMap[
                String(
                  studentRows[0].user_id ||
                    studentRows[0].student_id ||
                    ''
                )
              ] || null,

            // Overall event-level values.
            check_in_time:
              latestCheckIn,
            check_out_time:
              latestCheckOut,

            // IMPORTANT: this is now the source of truth.
            attendance_status:
              attendanceStatus,

            // Full per-session breakdown.
            session_attendance:
              sessionAttendance,
          };
        }
      );

      console.log(
        '================ ATTENDANCE SUMMARY ================'
      );

      console.table(
        mappedData.map((item: any) => ({
          student:
            item.profiles?.full_name ||
            item.profiles?.name ||
            item.user_id,
          status:
            item.attendance_status,
          sessions:
            item.session_attendance
              .map(
                (s: any) =>
                  `${s.session_name}: ${
                    s.check_in_time
                      ? 'IN'
                      : 'NO IN'
                  } / ${
                    s.check_out_time
                      ? 'OUT'
                      : 'NO OUT'
                  }`
              )
              .join(' | '),
        }))
      );

      console.log(
        '===================================================='
      );

      setAttendees(mappedData);
      return mappedData;
    } catch (err: any) {
      console.error(
        'Error fetching attendees:',
        err?.message || err
      );

      setAttendees([]);
      return [];
    } finally {
      setLoadingAttendees(false);
    }
  };

  // ============================================================
  // FORMAT SESSION DETAILS
  // ============================================================
  const formatSessionDetails = (item: any) => {
    const rows =
      item.session_attendance || [];

    if (!rows.length) {
      return {
        checkIn: item.check_in_time
          ? new Date(
              item.check_in_time
            ).toLocaleString()
          : 'NO CHECK-IN',
        checkOut: item.check_out_time
          ? new Date(
              item.check_out_time
            ).toLocaleString()
          : 'NO SIGN-OUT',
      };
    }

    const checkIn = rows
      .map((session: any) => {
        const value =
          session.check_in_time
            ? new Date(
                session.check_in_time
              ).toLocaleString()
            : 'NO CHECK-IN';

        return `${session.session_name}: ${value}`;
      })
      .join(' | ');

    const checkOut = rows
      .map((session: any) => {
        const value =
          session.check_out_time
            ? new Date(
                session.check_out_time
              ).toLocaleString()
            : 'NO SIGN-OUT';

        return `${session.session_name}: ${value}`;
      })
      .join(' | ');

    return {
      checkIn,
      checkOut,
    };
  };


  // ============================================================
  // OPEN EVENT DETAILS
  // ============================================================

  const handleViewAttendees = async (event: any) => {
    setSelectedEventSessions([]);

    await Promise.all([
      fetchAttendees(event),
      fetchEventSessions(event.id),
    ]);
  };
// ============================================================
// EXPORT ATTENDANCE TO CSV
//
// Every student who checked in is included.
//
// Overall status is based on ALL required sessions.
// A Full Day student is complete only after every session
// has both check-in and check-out.
// ============================================================

const handleExportCSV = async () => {
  if (!selectedEvent?.id) {
    setEventMsg({
      text: 'Please select an event first.',
      type: 'error',
    });
    return;
  }

  // Refresh from Supabase so checkout changes made after the modal opened are included.
  const currentAttendees = await fetchAttendees(selectedEvent);

  if (!currentAttendees || currentAttendees.length === 0) {
    return;
  }

  const headers = [
    'Student Name',
    'ID / Email',
    'Status',
    'Check-in Time',
    'Check-out Time',
  ];

  const rows = currentAttendees.map((item: any) => {
    const student =
      item.profiles || item;

    // --------------------------------------------------------
    // STUDENT NAME
    // --------------------------------------------------------

    const studentName =
      student.full_name ||
      student.display_name ||
      student.name ||
      'Student Attendee';

    // --------------------------------------------------------
    // STUDENT ID / EMAIL
    // --------------------------------------------------------

    const studentIdentifier =
      student.student_id ||
      student.student_number ||
      student.email ||
      item.user_id ||
      'N/A';

    // --------------------------------------------------------
    // STATUS
    // --------------------------------------------------------

    const finalStatus =
      item.attendance_status ||
      'PENDING';

    const sessionDetails =
      formatSessionDetails(item);

    // --------------------------------------------------------
    // CHECK-IN / CHECK-OUT
    // --------------------------------------------------------

    const checkInTime =
      sessionDetails.checkIn;

    const checkOutTime =
      sessionDetails.checkOut;

    // --------------------------------------------------------
    // ESCAPE CSV VALUES
    // --------------------------------------------------------

    const csvName =
      `"${String(studentName).replace(
        /"/g,
        '""'
      )}"`;

    const csvIdentifier =
      `"${String(studentIdentifier).replace(
        /"/g,
        '""'
      )}"`;

    const csvStatus =
      `"${finalStatus}"`;

    const csvCheckIn =
      `"${checkInTime}"`;

    const csvCheckOut =
      `"${checkOutTime}"`;

    return [
      csvName,
      csvIdentifier,
      csvStatus,
      csvCheckIn,
      csvCheckOut,
    ].join(',');
  });

  // ----------------------------------------------------------
  // CREATE CSV CONTENT
  // ----------------------------------------------------------

  const csvText = [
    headers.join(','),
    ...rows,
  ].join('\r\n');

  // ----------------------------------------------------------
  // CREATE REAL FILE
  // ----------------------------------------------------------

  const blob = new Blob(
    [csvText],
    {
      type: 'text/csv;charset=utf-8;',
    }
  );

  const url =
    URL.createObjectURL(blob);

  // ----------------------------------------------------------
  // DOWNLOAD
  // ----------------------------------------------------------

  const link =
    document.createElement('a');

  link.href = url;

  link.download =
    `${selectedEvent?.title || 'Event'}_Attendance_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

  document.body.appendChild(link);

  link.click();

  document.body.removeChild(link);

  // ----------------------------------------------------------
  // CLEAN UP
  // ----------------------------------------------------------

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
};


  // ============================================================
  // PRINT ATTENDANCE REPORT
  // Every student who checked in is printed.
  // Students without check-out are clearly marked NO SIGN-OUT.
  // ============================================================

  const handlePrintAttendance = async () => {
    if (!selectedEvent?.id) {
      setEventMsg({
        text: 'Please select an event first.',
        type: 'error',
      });
      return;
    }

    // Always refresh immediately before printing so the report uses the latest database state.
    const currentAttendees = await fetchAttendees(selectedEvent);

    if (!currentAttendees || currentAttendees.length === 0) {
      setEventMsg({
        text: 'No attendance records found for this event.',
        type: 'error',
      });
      return;
    }

    const html = (value: any) =>
      String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const formatDateTime = (value: any) => {
      if (!value) return '—';
      const date = new Date(value);
      return Number.isNaN(date.getTime())
        ? 'INVALID TIME'
        : date.toLocaleString([], {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
    };

    const completedCount = currentAttendees.filter(
      (item: any) => item.attendance_status === 'COMPLETED'
    ).length;

    const noSignOutCount = currentAttendees.filter(
      (item: any) => item.attendance_status === 'NO SIGN-OUT'
    ).length;

    const incompleteCount = currentAttendees.filter(
      (item: any) => item.attendance_status === 'INCOMPLETE'
    ).length;

    const pendingCount = currentAttendees.filter(
      (item: any) => item.attendance_status === 'PENDING'
    ).length;

    // One clean row per student. Each required session gets its own small
    // block instead of putting multiple long strings into one table cell.
    const rows = currentAttendees
      .map((item: any, index: number) => {
        const student = item.profiles || item;

        const name =
          student.full_name ||
          student.display_name ||
          student.name ||
          'Student Attendee';

        const identifier =
          student.student_id ||
          student.student_number ||
          student.email ||
          item.user_id ||
          'N/A';

        const status = item.attendance_status || 'PENDING';
        const statusClass =
          status === 'COMPLETED'
            ? 'status-completed'
            : status === 'NO SIGN-OUT'
            ? 'status-nosignout'
            : status === 'INCOMPLETE'
            ? 'status-incomplete'
            : 'status-pending';

        const sessions = Array.isArray(item.session_attendance)
          ? item.session_attendance
          : [];

        const sessionHtml = sessions.length
          ? sessions
              .map((session: any) => {
                const hasCheckIn = Boolean(session.check_in_time);
                const hasCheckOut = Boolean(session.check_out_time);
                const sessionState =
                  hasCheckIn && hasCheckOut
                    ? 'Complete'
                    : hasCheckIn
                    ? 'No Sign-Out'
                    : 'No Attendance';

                const sessionStateClass =
                  hasCheckIn && hasCheckOut
                    ? 'session-complete'
                    : hasCheckIn
                    ? 'session-nosignout'
                    : 'session-missing';

                return `
                  <div class="session-card">
                    <div class="session-header">
                      <strong>${html(session.session_name || 'Session')}</strong>
                      <span class="session-state ${sessionStateClass}">${html(sessionState)}</span>
                    </div>
                    <div class="session-times">
                      <div class="time-item">
                        <span class="time-label">CHECK-IN</span>
                        <span class="time-value ${hasCheckIn ? '' : 'muted'}">
                          ${html(formatDateTime(session.check_in_time))}
                        </span>
                      </div>
                      <div class="time-item">
                        <span class="time-label">CHECK-OUT</span>
                        <span class="time-value ${hasCheckOut ? 'checkout-ok' : 'checkout-missing'}">
                          ${html(formatDateTime(session.check_out_time))}
                        </span>
                      </div>
                    </div>
                  </div>`;
              })
              .join('')
          : `
              <div class="session-card">
                <div class="session-header">
                  <strong>Attendance</strong>
                  <span class="session-state session-missing">No Attendance</span>
                </div>
              </div>`;

        return `
          <tr>
            <td class="number">${index + 1}</td>
            <td class="student">
              <strong>${html(name)}</strong>
              <span>${html(identifier)}</span>
            </td>
            <td class="status-cell">
              <span class="status ${statusClass}">${html(status)}</span>
            </td>
            <td class="sessions-cell">
              <div class="sessions-list">${sessionHtml}</div>
            </td>
          </tr>`;
      })
      .join('');

    const printWindow = window.open(
      '',
      '_blank',
      'width=1400,height=950'
    );

    if (!printWindow) {
      setEventMsg({
        text: 'Please allow pop-ups in your browser to print the attendance report.',
        type: 'error',
      });
      return;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${html(selectedEvent?.title || 'Attendance Report')}</title>
  <style>
    * { box-sizing: border-box; }

    body {
      font-family: Arial, Helvetica, sans-serif;
      margin: 0;
      padding: 28px;
      color: #172033;
      background: #ffffff;
    }

    .report {
      max-width: 1250px;
      margin: 0 auto;
    }

    .top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 30px;
      border-bottom: 3px solid #172033;
      padding-bottom: 16px;
      margin-bottom: 16px;
    }

    h1 {
      margin: 0;
      font-size: 25px;
      line-height: 1.2;
    }

    .subtitle {
      margin-top: 5px;
      color: #64748b;
      font-size: 13px;
    }

    .meta {
      text-align: right;
      font-size: 11px;
      color: #475569;
      line-height: 1.7;
      white-space: nowrap;
    }

    .summary {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 9px;
      margin: 14px 0 18px;
    }

    .summary-card {
      border: 1px solid #dbe2ea;
      border-radius: 8px;
      padding: 9px 11px;
      background: #f8fafc;
    }

    .summary-label {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: .06em;
      color: #64748b;
    }

    .summary-value {
      margin-top: 2px;
      font-size: 18px;
      font-weight: 700;
      color: #172033;
    }

    table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      table-layout: fixed;
      margin-top: 4px;
      border: 1px solid #dbe2ea;
      border-radius: 8px;
      overflow: hidden;
    }

    th {
      background: #172033;
      color: #ffffff;
      padding: 10px 10px;
      border-right: 1px solid #334155;
      text-align: left;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: .04em;
    }

    th:last-child { border-right: none; }

    td {
      padding: 10px;
      border-top: 1px solid #dbe2ea;
      border-right: 1px solid #dbe2ea;
      font-size: 10px;
      vertical-align: top;
      background: #ffffff;
    }

    td:last-child { border-right: none; }
    tbody tr:nth-child(even) td { background: #f8fafc; }

    .number {
      width: 4%;
      text-align: center;
      color: #64748b;
      vertical-align: middle;
    }

    .student {
      width: 20%;
      vertical-align: middle;
    }

    .student strong {
      display: block;
      font-size: 12px;
      color: #172033;
    }

    .student span {
      display: block;
      margin-top: 3px;
      color: #64748b;
      font-size: 9px;
    }

    .status-cell {
      width: 12%;
      vertical-align: middle;
    }

    .sessions-cell { width: 64%; }

    .status {
      display: inline-block;
      padding: 5px 8px;
      border-radius: 999px;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: .02em;
      white-space: nowrap;
    }

    .status-completed {
      color: #166534;
      background: #dcfce7;
      border: 1px solid #bbf7d0;
    }

    .status-nosignout {
      color: #b91c1c;
      background: #fee2e2;
      border: 1px solid #fecaca;
    }

    .status-incomplete {
      color: #9a3412;
      background: #ffedd5;
      border: 1px solid #fed7aa;
    }

    .status-pending {
      color: #475569;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
    }

    .sessions-list {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .session-card {
      border: 1px solid #dbe2ea;
      border-radius: 7px;
      padding: 8px;
      background: #f8fafc;
      page-break-inside: avoid;
    }

    .session-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding-bottom: 6px;
      margin-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
    }

    .session-header strong {
      font-size: 10px;
      color: #172033;
    }

    .session-state {
      display: inline-block;
      padding: 2px 5px;
      border-radius: 999px;
      font-size: 7px;
      font-weight: 700;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .session-complete {
      color: #166534;
      background: #dcfce7;
    }

    .session-nosignout {
      color: #b91c1c;
      background: #fee2e2;
    }

    .session-missing {
      color: #9a3412;
      background: #ffedd5;
    }

    .session-times {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
    }

    .time-item {
      min-width: 0;
    }

    .time-label {
      display: block;
      color: #64748b;
      font-size: 7px;
      font-weight: 700;
      letter-spacing: .05em;
      margin-bottom: 2px;
    }

    .time-value {
      display: block;
      color: #334155;
      font-size: 8.5px;
      line-height: 1.3;
      overflow-wrap: anywhere;
    }

    .muted { color: #94a3b8; }
    .checkout-ok { color: #166534; font-weight: 700; }
    .checkout-missing { color: #b91c1c; font-weight: 700; }

    .legend {
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid #dbe2ea;
      color: #64748b;
      font-size: 9px;
      line-height: 1.6;
    }

    .legend strong { color: #334155; }

    @media print {
      body { padding: 0; }
      .report { max-width: none; }
      @page { size: A4 landscape; margin: 9mm; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="report">
    <div class="top">
      <div>
        <h1>${html(selectedEvent?.title || 'Attendance Report')}</h1>
        <div class="subtitle">Campus Attendance Report</div>
      </div>
      <div class="meta">
        <div><strong>Location:</strong> ${html(selectedEvent?.location || selectedEvent?.venue || 'N/A')}</div>
        <div><strong>Event Date:</strong> ${html(selectedEvent?.event_date || 'N/A')}</div>
        <div><strong>Generated:</strong> ${html(new Date().toLocaleString())}</div>
      </div>
    </div>

    <div class="summary">
      <div class="summary-card">
        <div class="summary-label">Total Students</div>
        <div class="summary-value">${currentAttendees.length}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Completed</div>
        <div class="summary-value">${completedCount}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">No Sign-Out</div>
        <div class="summary-value">${noSignOutCount}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Incomplete</div>
        <div class="summary-value">${incompleteCount}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">Pending</div>
        <div class="summary-value">${pendingCount}</div>
      </div>
    </div>

    <table>
      <colgroup>
        <col style="width:4%" />
        <col style="width:20%" />
        <col style="width:12%" />
        <col style="width:64%" />
      </colgroup>
      <thead>
        <tr>
          <th>#</th>
          <th>Student</th>
          <th>Status</th>
          <th>Session Attendance</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="legend">
      <strong>COMPLETED</strong> = every required session has both check-in and check-out.<br />
      <strong>NO SIGN-OUT</strong> = the student checked in, but one or more required sessions has no checkout.<br />
      <strong>INCOMPLETE</strong> = a required session has already finished but the student has no attendance record for it.<br />
      <strong>PENDING</strong> = a required session has not happened yet.
    </div>
  </div>

  <script>
    window.onload = function () {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>`);

    printWindow.document.close();
  };

  // ============================================================
  // DELETE EVENT
  // ============================================================

  const handleDeleteEvent = async (
    eventId: string,
    eventTitle: string
  ) => {
    const confirmDelete =
      window.confirm(
        `Are you sure you want to delete "${eventTitle}"? This will also remove associated attendance logs and sessions.`
      );

    if (!confirmDelete) {
      return;
    }

    try {
      // Delete attendance records
      const {
        error: attendanceDeleteError,
      } = await supabase
        .from('attendances')
        .delete()
        .eq(
          'event_id',
          eventId
        );

      if (attendanceDeleteError) {
        throw attendanceDeleteError;
      }

      // Delete event sessions
      const {
        error: sessionDeleteError,
      } = await supabase
        .from('dev_event_sessions')
        .delete()
        .eq(
          'event_id',
          eventId
        );

      if (sessionDeleteError) {
        throw sessionDeleteError;
      }

      // Delete event
      const {
        error,
      } = await supabase
        .from('events')
        .delete()
        .eq(
          'id',
          eventId
        );

      if (error) {
        throw error;
      }

      // Update UI
      setEvents(
        (previousEvents) =>
          previousEvents.filter(
            (event) =>
              event.id !== eventId
          )
      );
    } catch (err: any) {
      console.error(
        'Error deleting event:',
        err
      );

      alert(
        `Error deleting event: ${
          err?.message ||
          'Unknown error'
        }`
      );
    }
  };

  // ============================================================
  // LOGOUT
  // ============================================================

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error(
        'Logout error:',
        error
      );
    } finally {
      router.replace('/login');
    }
  };

  // ============================================================
  // TIME HELPER
  // Add minutes to a local HH:MM time without timezone conversion.
  // Example: 15:34 + 15 minutes = 15:49:00
  // ============================================================

  const addMinutesToTime = (
    time: string,
    minutes: number
  ): string => {
    const [hours, mins] = time
      .split(':')
      .map(Number);

    const totalMinutes =
      hours * 60 + mins + minutes;

    const normalized =
      ((totalMinutes % 1440) + 1440) % 1440;

    const resultHours = Math.floor(
      normalized / 60
    );

    const resultMinutes =
      normalized % 60;

    return `${String(resultHours).padStart(2, '0')}:${String(
      resultMinutes
    ).padStart(2, '0')}:00`;
  };

  // ============================================================
  // CREATE EVENT
  // ============================================================

  const handleCreateEvent = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setEventLoading(true);
    setEventMsg(null);

    if (
      !eventTitle.trim() ||
      !eventLocation.trim() ||
      !eventDate ||
      !checkInStart ||
      !checkInEnd ||
      !checkOutStart ||
      !checkOutEnd
    ) {
      setEventMsg({
        text: 'Please fill in all required fields.',
        type: 'error',
      });
      setIsSubmitting(false);
      setEventLoading(false);
      return;
    }

    if (checkInEnd <= checkInStart) {
      setEventMsg({
        text: 'Check-In end time must be later than Check-In start time.',
        type: 'error',
      });
      setIsSubmitting(false);
      setEventLoading(false);
      return;
    }

    if (checkOutEnd <= checkOutStart) {
      setEventMsg({
        text: 'Check-Out end time must be later than Check-Out start time.',
        type: 'error',
      });
      setIsSubmitting(false);
      setEventLoading(false);
      return;
    }

    try {
      // Convert HTML time inputs (HH:MM) into PostgreSQL TIME values (HH:MM:SS).
      const formattedCheckInStart =
        checkInStart.length === 5
          ? `${checkInStart}:00`
          : checkInStart;

      const formattedCheckInEnd =
        checkInEnd.length === 5
          ? `${checkInEnd}:00`
          : checkInEnd;

      const formattedCheckOutStart =
        checkOutStart.length === 5
          ? `${checkOutStart}:00`
          : checkOutStart;

      const formattedCheckOutEnd =
        checkOutEnd.length === 5
          ? `${checkOutEnd}:00`
          : checkOutEnd;

      // The event itself spans the complete Check-In -> Check-Out period.
      const startTimestamp = new Date(
        `${eventDate}T${checkInStart}:00`
      ).toISOString();

      const endTimestamp = new Date(
        `${eventDate}T${checkOutEnd}:00`
      ).toISOString();

      // ========================================================
      // 1. CREATE EVENT
      // ========================================================

      const {
        data: createdEvent,
        error: eventError,
      } = await supabase
        .from('events')
        .insert([
          {
            title: eventTitle.trim(),
            location: eventLocation.trim(),
            venue: eventLocation.trim(),
            event_date: eventDate,
            start_time: startTimestamp,
            end_time: endTimestamp,
          },
        ])
        .select()
        .single();

      if (eventError) {
        throw eventError;
      }

      if (!createdEvent) {
        throw new Error(
          'Event was created but no event ID was returned.'
        );
      }

      // ========================================================
      // 2. CREATE ATTENDANCE SESSIONS
      // ========================================================
      // NOTE:
      // dev_event_sessions must contain checkout_start and checkout_end
      // TIME columns. Run the SQL migration supplied below this file once.

      const sessionsToInsert: any[] = [];

      if (
        sessionType === 'morning' ||
        sessionType === 'full'
      ) {
        sessionsToInsert.push({
          event_id: createdEvent.id,
          session_name: 'Morning Session',
          session_date: eventDate,
          attendance_start: formattedCheckInStart,
          attendance_end: formattedCheckInEnd,
          cutoff_time: formattedCheckInEnd,
          checkout_start: formattedCheckOutStart,
          checkout_end: formattedCheckOutEnd,
        });
      }

      if (
        sessionType === 'afternoon' ||
        sessionType === 'full'
      ) {
        sessionsToInsert.push({
          event_id: createdEvent.id,
          session_name: 'Afternoon Session',
          session_date: eventDate,
          attendance_start: formattedCheckInStart,
          attendance_end: formattedCheckInEnd,
          cutoff_time: formattedCheckInEnd,
          checkout_start: formattedCheckOutStart,
          checkout_end: formattedCheckOutEnd,
        });
      }

      if (sessionsToInsert.length === 0) {
        throw new Error(
          'No attendance session was selected.'
        );
      }

      const {
        error: sessionError,
      } = await supabase
        .from('dev_event_sessions')
        .insert(sessionsToInsert);

      if (sessionError) {
        // Roll back the event if session creation fails.
        await supabase
          .from('events')
          .delete()
          .eq('id', createdEvent.id);

        throw new Error(
          `Event could not be completed because its attendance sessions could not be created: ${sessionError.message}`
        );
      }

      // ========================================================
      // 3. SUCCESS
      // ========================================================

      const sessionLabel =
        sessionType === 'morning'
          ? 'Morning Only'
          : sessionType === 'afternoon'
          ? 'Afternoon Only'
          : 'Full Day';

      setEventMsg({
        text: `Event created successfully as a ${sessionLabel} event!`,
        type: 'success',
      });

      setEventTitle('');
      setEventLocation('');
      setEventDate('');
      setCheckInStart('07:30');
      setCheckInEnd('09:00');
      setCheckOutStart('11:30');
      setCheckOutEnd('12:30');
      setSessionType('full');

      await fetchEvents();

      setTimeout(() => {
        setIsEventModalOpen(false);
        setEventMsg(null);
      }, 1500);
    } catch (err: any) {
      console.error(
        'Error creating event:',
        err
      );

      setEventMsg({
        text:
          err?.message ||
          'Failed to create event.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
      setEventLoading(false);
    }
  };

  // ============================================================
  // CHANGE PASSWORD
  // ============================================================

  const handleChangePassword = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setPasswordMsg(null);

    if (newPassword.length < 6) {
      setPasswordMsg({
        text:
          'Password must be at least 6 characters long.',
        type: 'error',
      });

      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      setPasswordMsg({
        text:
          'Passwords do not match!',
        type: 'error',
      });

      return;
    }

    try {
      setPasswordLoading(true);

      const {
        error,
      } =
        await supabase.auth.updateUser({
          password:
            newPassword,
        });

      if (error) {
        throw error;
      }

      setPasswordMsg({
        text:
          'Password updated successfully!',
        type: 'success',
      });

      setNewPassword('');
      setConfirmPassword('');

      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPasswordMsg(null);
      }, 2000);
    } catch (err: any) {
      console.error(
        'Password update error:',
        err
      );

      setPasswordMsg({
        text:
          err?.message ||
          'Failed to update password.',
        type: 'error',
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  // ============================================================
  // AUTHORIZATION LOADING SCREEN
  // ============================================================

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center text-sm">
        <div className="flex flex-col items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-indigo-400 animate-pulse" />

          <p>
            Verifying authorization...
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // ADMIN DASHBOARD
  // ============================================================

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">

      <div>

        {/* ======================================================
            TOP NAVIGATION
        ======================================================= */}

        <header className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex flex-wrap items-center justify-between gap-4">

          <div className="flex items-center gap-3">

            <div className="bg-indigo-600/20 p-2 rounded-lg border border-indigo-500/30 text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div>
              <h1 className="font-bold text-lg text-white leading-tight">
                Campus Cert System
              </h1>

              <p className="text-xs text-indigo-400 font-medium">
                Officer Portal
              </p>
            </div>

          </div>

          <div className="flex items-center gap-2 sm:gap-3">

            {/* Scanner */}

            <button
              onClick={() =>
                router.push(
                  '/admin/scan'
                )
              }
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-700 transition"
            >
              <QrCode className="w-4 h-4 text-indigo-400" />
              Scanner Mode
            </button>

            {/* Change Password */}

            <button
              onClick={() => {
                setPasswordMsg(null);
                setIsPasswordModalOpen(
                  true
                );
              }}
              className="flex items-center gap-2 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 text-xs font-semibold px-3 py-2 rounded-lg border border-indigo-500/20 transition"
            >
              <Key className="w-4 h-4" />
              Change Password
            </button>

            {/* Logout */}

            <button
              onClick={
                handleLogout
              }
              className="flex items-center gap-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 text-xs font-semibold px-3 py-2 rounded-lg border border-rose-500/20 transition"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>

          </div>

        </header>

        {/* ======================================================
            MAIN CONTENT
        ======================================================= */}

        <main className="max-w-6xl mx-auto p-6 md:p-8">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">

            <div>
              <h2 className="text-3xl font-extrabold text-white">
                Officer Dashboard
              </h2>

              <p className="text-slate-400 text-sm mt-1">
                Manage campus events, generate QR check-ins,
                and track attendance.
              </p>
            </div>

            <button
              onClick={() => {
                setEventMsg(null);
                setIsEventModalOpen(
                  true
                );
              }}
              className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition text-sm cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create New Event
            </button>

          </div>

          {/* ====================================================
              ACTIVE EVENTS
          ===================================================== */}

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl">

            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-400" />
              Active Campus Events
            </h3>

            {loading ? (

              <div className="text-center py-12 text-slate-500 text-sm">
                Loading events...
              </div>

            ) : events.length === 0 ? (

              <div className="text-center py-16 bg-slate-900/40 rounded-xl border border-slate-800/80">

                <p className="text-slate-400 text-sm">
                  No events created yet.
                  Click{' '}
                  <span className="text-indigo-400 font-semibold">
                    "Create New Event"
                  </span>{' '}
                  above to publish your first event!
                </p>

              </div>

            ) : (

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

                {events.map(
                  (event) => (

                    <div
                      key={event.id}
                      className="bg-slate-800/80 border border-slate-700/80 p-5 rounded-xl hover:border-indigo-500/50 transition flex flex-col justify-between relative group"
                    >

                      <div>

                        <div className="flex items-start justify-between gap-2 mb-2">

                          <h4 className="font-bold text-white text-base leading-snug">
                            {event.title}
                          </h4>

                          <button
                            onClick={() =>
                              handleDeleteEvent(
                                event.id,
                                event.title
                              )
                            }
                            title="Delete finished event"
                            className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 p-1.5 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                        </div>

                        <div className="space-y-1 mb-4">

                          <p className="text-xs text-slate-400 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                            {event.venue ||
                              event.location}
                          </p>

                          {event.event_date && (

                            <p className="text-xs text-slate-400 flex items-center gap-1.5">

                              <Clock className="w-3.5 h-3.5 text-indigo-400" />

                              {new Date(
                                event.event_date
                              ).toLocaleDateString()}

                              {event.start_time &&
                                ` • ${new Date(
                                  event.start_time
                                ).toLocaleTimeString([], {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true,
                                })}`}

                            </p>

                          )}

                        </div>

                      </div>

                      <button
                        onClick={() =>
                          handleViewAttendees(
                            event
                          )
                        }
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 text-xs font-semibold py-2 rounded-lg transition mt-2 cursor-pointer"
                      >
                        <Users className="w-4 h-4" />
                        View Attendees
                      </button>

                    </div>

                  )
                )}

              </div>

            )}

          </div>

        </main>

      </div>

      {/* ========================================================
          ATTENDEES + SESSIONS MODAL
      ========================================================= */}

      {selectedEvent && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-6xl shadow-2xl relative flex flex-col max-h-[92vh] overflow-hidden">

            {/* MODAL HEADER */}
            <div className="shrink-0 border-b border-slate-800 p-5 sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 pr-8">
                  <div className="bg-indigo-600/20 p-2.5 rounded-xl border border-indigo-500/30 text-indigo-400 shrink-0">
                    <UserCheck className="w-6 h-6" />
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-xl font-bold text-white leading-tight break-words">
                      {selectedEvent.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      Attendance records, sessions, check-in and check-out status
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="inline-flex items-center justify-center gap-2 bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-xl transition text-sm font-semibold"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintAttendance}
                    className="inline-flex items-center justify-center gap-2 bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-indigo-300 px-4 py-2.5 rounded-xl transition text-sm font-semibold"
                  >
                    <span className="text-sm">🖨️</span>
                    Print Report
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedEvent(null);
                  setSelectedEventSessions([]);
                  setAttendees([]);
                }}
                aria-label="Close event details"
                className="absolute top-4 right-4 text-slate-400 hover:text-white hover:bg-slate-800 p-2 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* MODAL CONTENT */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* EVENT SESSIONS */}
                <section className="min-w-0">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <h4 className="text-base font-bold text-white flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-indigo-400" />
                        Event Sessions
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Check-in and checkout windows configured for this event.
                      </p>
                    </div>

                    <span className="shrink-0 text-[11px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2.5 py-1 rounded-full">
                      {selectedEventSessions.length} session{selectedEventSessions.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {selectedEventSessions.length === 0 ? (
                    <div className="text-center py-8 bg-slate-950/50 rounded-xl border border-slate-800">
                      <p className="text-slate-500 text-sm">
                        No sessions found for this event.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedEventSessions.map((session: any, index: number) => (
                        <div
                          key={session.id || index}
                          className="bg-slate-950 border border-slate-800 rounded-xl p-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-base font-semibold text-white break-words">
                                {session.session_name ||
                                  session.title ||
                                  `Session ${index + 1}`}
                              </p>

                              <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                {session.session_date
                                  ? new Date(session.session_date).toLocaleDateString()
                                  : selectedEvent.event_date
                                  ? new Date(selectedEvent.event_date).toLocaleDateString()
                                  : 'Event date'}
                              </p>
                            </div>

                            <div className="shrink-0 text-right space-y-1.5">
                              {session.attendance_start && (
                                <p className="text-xs text-emerald-400 whitespace-nowrap">
                                  <span className="text-slate-500">In:</span>{' '}
                                  {formatTime12Hour(session.attendance_start)}
                                  {session.attendance_end &&
                                    ` – ${formatTime12Hour(session.attendance_end)}`}
                                </p>
                              )}

                              {session.checkout_start && (
                                <p className="text-xs text-rose-400 whitespace-nowrap">
                                  <span className="text-slate-500">Out:</span>{' '}
                                  {formatTime12Hour(session.checkout_start)}
                                  {session.checkout_end &&
                                    ` – ${formatTime12Hour(session.checkout_end)}`}
                                </p>
                              )}

                              {session.cutoff_time && (
                                <p className="text-xs text-amber-400 whitespace-nowrap">
                                  <span className="text-slate-500">Cutoff:</span>{' '}
                                  {formatTime12Hour(session.checkout_end)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* ATTENDEES */}
                <section className="min-w-0">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                      <h4 className="text-base font-bold text-white flex items-center gap-2">
                        <Users className="w-4 h-4 text-indigo-400" />
                        Attendance Records
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Each student is evaluated across every required attendance session.
                      </p>
                    </div>

                    <span className="shrink-0 text-[11px] text-slate-400 bg-slate-800 px-2.5 py-1 rounded-full">
                      {attendees.length} student{attendees.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {loadingAttendees ? (
                    <div className="text-center py-10 bg-slate-950/50 rounded-xl border border-slate-800">
                      <p className="text-slate-500 text-sm">
                        Loading attendance records...
                      </p>
                    </div>
                  ) : attendees.length === 0 ? (
                    <div className="text-center py-10 bg-slate-950/50 rounded-xl border border-slate-800">
                      <p className="text-slate-400 text-sm">
                        No students have logged into this event yet.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {attendees.map((item: any, idx: number) => {
                        const student =
                          item.profiles || item;

                        const status =
                          item.attendance_status ||
                          'PENDING';

                        const completed =
                          status === 'COMPLETED';

                        const statusClass =
                          completed
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : status === 'PENDING'
                            ? 'bg-slate-500/5 border-slate-700'
                            : 'bg-rose-500/5 border-rose-500/20';

                        const badgeClass =
                          completed
                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                            : status === 'PENDING'
                            ? 'bg-slate-500/10 text-slate-300 border-slate-600'
                            : 'bg-rose-500/10 text-rose-300 border-rose-500/20';

                        return (
                          <div
                            key={item.id || idx}
                            className={`rounded-xl border p-4 ${statusClass}`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-white break-words">
                                  {student.full_name ||
                                    student.display_name ||
                                    student.name ||
                                    'Student Attendee'}
                                </p>

                                <p className="text-xs text-slate-400 mt-0.5 break-all">
                                  {student.student_id ||
                                    student.student_number ||
                                    student.email ||
                                    item.user_id ||
                                    'Registered Student'}
                                </p>
                              </div>

                              <span
                                className={`self-start text-[11px] px-2.5 py-1 rounded-full font-bold border shrink-0 ${badgeClass}`}
                              >
                                {status}
                              </span>
                            </div>

                            <div className="space-y-2 mt-3">
                              {(item.session_attendance || []).map(
                                (sessionRow: any) => {
                                  const sessionComplete =
                                    Boolean(
                                      sessionRow.check_in_time
                                    ) &&
                                    Boolean(
                                      sessionRow.check_out_time
                                    );

                                  const sessionHasCheckIn =
                                    Boolean(
                                      sessionRow.check_in_time
                                    );

                                  return (
                                    <div
                                      key={
                                        sessionRow.session_id
                                      }
                                      className="bg-slate-950/70 rounded-lg p-3 border border-slate-800"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-xs font-semibold text-white">
                                          {sessionRow.session_name}
                                        </p>

                                        <span
                                          className={`text-[9px] px-2 py-0.5 rounded-full border font-bold ${
                                            sessionComplete
                                              ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
                                              : sessionHasCheckIn
                                              ? 'text-rose-300 bg-rose-500/10 border-rose-500/20'
                                              : 'text-slate-300 bg-slate-500/10 border-slate-600'
                                          }`}
                                        >
                                          {sessionComplete
                                            ? 'COMPLETE'
                                            : sessionHasCheckIn
                                            ? 'NO SIGN-OUT'
                                            : 'NO ATTENDANCE'}
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                        <div>
                                          <p className="text-[10px] uppercase tracking-wide text-slate-500">
                                            Check-in
                                          </p>
                                          <p className="text-xs text-slate-200 mt-0.5 break-words">
                                            {sessionRow.check_in_time
                                              ? new Date(
                                                  sessionRow.check_in_time
                                                ).toLocaleString()
                                              : 'NO CHECK-IN'}
                                          </p>
                                        </div>

                                        <div>
                                          <p className="text-[10px] uppercase tracking-wide text-slate-500">
                                            Check-out
                                          </p>
                                          <p
                                            className={`text-xs mt-0.5 break-words ${
                                              sessionRow.check_out_time
                                                ? 'text-emerald-300'
                                                : 'text-rose-300'
                                            }`}
                                          >
                                            {sessionRow.check_out_time
                                              ? new Date(
                                                  sessionRow.check_out_time
                                                ).toLocaleString()
                                              : 'NO SIGN-OUT'}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            </div>

            {/* MODAL FOOTER */}
            <div className="shrink-0 border-t border-slate-800 px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-400">
                  Total Students:
                  <strong className="text-white ml-1">{attendees.length}</strong>
                </span>
                <span className="text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full">
                  Completed: {attendees.filter((item: any) => item.attendance_status === 'COMPLETED').length}
                </span>
                <span className="text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-full">
                  No Sign-Out: {attendees.filter((item: any) => item.attendance_status === 'NO SIGN-OUT').length}
                </span>
                <span className="text-rose-300 bg-rose-500/10 border border-rose-500/20 px-2 py-1 rounded-full">
                  Incomplete: {attendees.filter((item: any) => item.attendance_status === 'INCOMPLETE').length}
                </span>
                <span className="text-slate-300 bg-slate-500/10 border border-slate-600 px-2 py-1 rounded-full">
                  Pending: {attendees.filter((item: any) => item.attendance_status === 'PENDING').length}
                </span>
              </div>

              <button
                onClick={() => {
                  setSelectedEvent(null);
                  setSelectedEventSessions([]);
                  setAttendees([]);
                }}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          CREATE EVENT MODAL
      ========================================================= */}

      {isEventModalOpen && (

        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">

          {/* SCROLLABLE MODAL */}

          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative">

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() =>
                setIsEventModalOpen(
                  false
                )
              }
              className="absolute top-4 right-4 text-slate-400 hover:text-white disabled:opacity-40"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">

              <div className="bg-indigo-600/20 p-2.5 rounded-xl border border-indigo-500/30 text-indigo-400">
                <Calendar className="w-6 h-6" />
              </div>

              <div>

                <h3 className="text-lg font-bold text-white">
                  Create New Event
                </h3>

                <p className="text-xs text-slate-400">
                  Publish a new campus event for attendance
                </p>

              </div>

            </div>

            {eventMsg && (

              <div
                className={`p-3 rounded-lg text-xs font-semibold mb-4 flex items-center gap-2 ${
                  eventMsg.type ===
                  'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                }`}
              >

                {eventMsg.type ===
                'success' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <X className="w-4 h-4" />
                )}

                {eventMsg.text}

              </div>

            )}

            <form
              onSubmit={
                handleCreateEvent
              }
              className="space-y-5"
            >

              {/* EVENT TITLE */}

              <div>

                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Event Title
                </label>

                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  placeholder="e.g. IT Foundation Day 2026"
                  value={eventTitle}
                  onChange={(e) =>
                    setEventTitle(
                      e.target.value
                    )
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                />

              </div>

              {/* LOCATION */}

              <div>

                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Location / Venue
                </label>

                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  placeholder="e.g. Campus Gymnasium"
                  value={eventLocation}
                  onChange={(e) =>
                    setEventLocation(
                      e.target.value
                    )
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                />

              </div>

              {/* DATE */}

              <div>

                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Event Date
                </label>

                <input
                  type="date"
                  required
                  disabled={isSubmitting}
                  value={eventDate}
                  onChange={(e) =>
                    setEventDate(
                      e.target.value
                    )
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                />

              </div>

              {/* ==================================================
                  SESSION TYPE
              =================================================== */}

              <div>

                <label className="block text-xs font-medium text-slate-400 mb-2">
                  Event Schedule Type
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">

                  {/* MORNING */}

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() =>
                      setSessionType(
                        'morning'
                      )
                    }
                    className={`py-2.5 px-3 rounded-xl text-xs font-medium border transition ${
                      sessionType ===
                      'morning'
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    } disabled:opacity-50`}
                  >
                    🌅 Morning Only
                  </button>

                  {/* AFTERNOON */}

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() =>
                      setSessionType(
                        'afternoon'
                      )
                    }
                    className={`py-2.5 px-3 rounded-xl text-xs font-medium border transition ${
                      sessionType ===
                      'afternoon'
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    } disabled:opacity-50`}
                  >
                    ☀️ Afternoon Only
                  </button>

                  {/* FULL DAY */}

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() =>
                      setSessionType(
                        'full'
                      )
                    }
                    className={`py-2.5 px-3 rounded-xl text-xs font-medium border transition ${
                      sessionType ===
                      'full'
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    } disabled:opacity-50`}
                  >
                    📅 Full Day
                  </button>

                </div>

                {/* SCHEDULE DESCRIPTION */}

                <div className="mt-2 bg-slate-950/60 border border-slate-800 rounded-xl p-3">

                  <p className="text-[11px] text-slate-400 leading-relaxed">

                    {sessionType ===
                    'morning' && (
                      <>
                        🌅 Morning Only:
                        creates one morning
                        attendance session.
                      </>
                    )}

                    {sessionType ===
                    'afternoon' && (
                      <>
                        ☀️ Afternoon Only:
                        creates one afternoon
                        attendance session.
                      </>
                    )}

                    {sessionType ===
                    'full' && (
                      <>
                        📅 Full Day: creates
                        both Morning and
                        Afternoon attendance
                        sessions.
                      </>
                    )}

                  </p>

                </div>

              </div>

              {/* ==================================================
                  CHECK-IN / CHECK-OUT WINDOWS
              =================================================== */}

              {/* CHECK-IN WINDOW */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <label className="block text-xs font-bold text-emerald-400">
                  🟢 Check-In Time Window (In Attendance)
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">
                      In Starts At
                    </label>
                    <input
                      type="time"
                      required
                      disabled={isSubmitting}
                      value={checkInStart}
                      onChange={(e) =>
                        setCheckInStart(e.target.value)
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">
                      In Ends At (Cutoff)
                    </label>
                    <input
                      type="time"
                      required
                      disabled={isSubmitting}
                      value={checkInEnd}
                      onChange={(e) =>
                        setCheckInEnd(e.target.value)
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>

              {/* CHECK-OUT WINDOW */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                <label className="block text-xs font-bold text-rose-400">
                  🔴 Check-Out Time Window (Out Attendance)
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">
                      Out Starts At
                    </label>
                    <input
                      type="time"
                      required
                      disabled={isSubmitting}
                      value={checkOutStart}
                      onChange={(e) =>
                        setCheckOutStart(e.target.value)
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">
                      Out Ends At
                    </label>
                    <input
                      type="time"
                      required
                      disabled={isSubmitting}
                      value={checkOutEnd}
                      onChange={(e) =>
                        setCheckOutEnd(e.target.value)
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>

              {/* ==================================================
                  SESSION PREVIEW
              =================================================== */}

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  <p className="text-xs font-semibold text-white">
                    Session Schedule
                  </p>
                </div>

                <div className="space-y-2">
                  {(sessionType === 'morning' || sessionType === 'full') && (
                    <div className="text-[11px] text-slate-400">
                      <p>
                        🌅 Morning Session:{' '}
                        <span className="text-emerald-400 font-semibold">
                          {formatTime12Hour(checkInStart)} – {formatTime12Hour(checkInEnd)}
                        </span>
                      </p>
                      <p className="mt-1 text-slate-500">
                        Check-Out:{' '}
                        <span className="text-rose-400">
                          {formatTime12Hour(checkOutStart)} – {formatTime12Hour(checkOutEnd)}
                        </span>
                      </p>
                    </div>
                  )}

                  {sessionType === 'full' && (
                    <div className="border-t border-slate-800 pt-2" />
                  )}

                  {(sessionType === 'afternoon' || sessionType === 'full') && (
                    <div className="text-[11px] text-slate-400">
                      <p>
                        ☀️ Afternoon Session:{' '}
                        <span className="text-emerald-400 font-semibold">
                          {formatTime12Hour(checkInStart)} – {formatTime12Hour(checkInEnd)}
                        </span>
                      </p>
                      <p className="mt-1 text-slate-500">
                        Check-Out:{' '}
                        <span className="text-rose-400">
                          {formatTime12Hour(checkOutStart)} – {formatTime12Hour(checkOutEnd)}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* ==================================================
                  BUTTONS
              =================================================== */}

              <div className="flex items-center justify-end gap-3 pt-2">

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() =>
                    setIsEventModalOpen(
                      false
                    )
                  }
                  className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 text-xs font-semibold hover:bg-slate-800 transition disabled:opacity-40"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    isSubmitting
                  }
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >

                  {isSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    'Publish Event'
                  )}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* ========================================================
          CHANGE PASSWORD MODAL
      ========================================================= */}

      {isPasswordModalOpen && (

        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">

          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">

            <button
              onClick={() =>
                setIsPasswordModalOpen(
                  false
                )
              }
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-6">

              <div className="bg-indigo-600/20 p-2.5 rounded-xl border border-indigo-500/30 text-indigo-400">
                <Key className="w-6 h-6" />
              </div>

              <div>

                <h3 className="text-lg font-bold text-white">
                  Change Password
                </h3>

                <p className="text-xs text-slate-400">
                  Update your user account password
                </p>

              </div>

            </div>

            {passwordMsg && (

              <div
                className={`p-3 rounded-lg text-xs font-semibold mb-4 flex items-center gap-2 ${
                  passwordMsg.type ===
                  'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                }`}
              >

                {passwordMsg.type ===
                'success' ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <X className="w-4 h-4" />
                )}

                {passwordMsg.text}

              </div>

            )}

            <form
              onSubmit={
                handleChangePassword
              }
              className="space-y-4"
            >

              <div>

                <label className="block text-xs font-medium text-slate-400 mb-1">
                  New Password
                </label>

                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) =>
                    setNewPassword(
                      e.target.value
                    )
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />

              </div>

              <div>

                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Confirm Password
                </label>

                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={
                    confirmPassword
                  }
                  onChange={(e) =>
                    setConfirmPassword(
                      e.target.value
                    )
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                />

              </div>

              <div className="flex items-center justify-end gap-3 mt-6">

                <button
                  type="button"
                  onClick={() =>
                    setIsPasswordModalOpen(
                      false
                    )
                  }
                  className="px-4 py-2.5 rounded-xl border border-slate-800 text-slate-400 text-xs font-semibold hover:bg-slate-800 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    passwordLoading
                  }
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 transition disabled:opacity-50 flex items-center gap-2"
                >

                  {passwordLoading
                    ? 'Updating...'
                    : 'Update Password'}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* ========================================================
          FOOTER
      ========================================================= */}

      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-4 px-6 text-center text-xs text-slate-500">

        <p>
          © 2026 Campus Certificate & Attendance System
          {' • '}
          Developed & Owned by{' '}

          <span className="text-indigo-400 font-semibold">
            Christian Rey Wata
          </span>
        </p>

      </footer>

    </div>
  );
}