export interface EventSession {
  id: string;
  event_id: string;
  session_name: string;
  session_date: string;
  check_in_start: string;
  check_in_late: string;
  check_in_end: string;
  check_out_start: string;
  check_out_end: string;
}

export interface SessionAttendance {
  id: string;
  event_id: string;
  session_id: string;
  user_id: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: 'PRESENT' | 'LATE' | 'INCOMPLETE' | 'ABSENT';
  profiles?: {
    full_name: string;
    student_id: string;
    year_level?: string;
    section?: string;
    year_and_section?: string;
  };
}