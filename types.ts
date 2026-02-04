export enum AttendanceStatus {
  PENDING = 'PENDING',
  ATTENDED = 'ATTENDED',
  ABSENT = 'ABSENT',
  SUSPENDED = 'SUSPENDED', // Class cancelled
  EXCUSED = 'EXCUSED',
}

export interface CalendarEvent {
  id: string;
  uid: string; // From ICS
  title: string;
  start: Date;
  end: Date;
  location?: string;
  description?: string;
  status: AttendanceStatus;
  overrideTitle?: string; // If overriden by different event
  isOverride?: boolean;
  recurrenceId?: string; // To group repeated events
  originalDate?: Date; // For sorting recurrence
}

export interface Stats {
  total: number;
  attended: number;
  absent: number;
  suspended: number;
  excused: number;
  pending: number;
  percentage: number;
  neededFor75: number;
}

export interface GroupedStats {
  [title: string]: Stats;
}