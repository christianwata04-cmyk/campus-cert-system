// Set to true while testing locally so you don't affect production data
export const IS_DEV_MODE = process.env.NODE_ENV === 'development';

export const TABLES = {
  EVENTS: 'events',
  SESSIONS: IS_DEV_MODE ? 'dev_event_sessions' : 'event_sessions',
  ATTENDANCES: IS_DEV_MODE ? 'dev_attendances' : 'attendances',
  USERS: 'users',
  ALLOWED_STUDENTS: 'allowed_students',
};