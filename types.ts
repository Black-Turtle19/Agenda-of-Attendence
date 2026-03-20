export enum AttendanceStatus {
  PENDING = 'PENDING',
  ATTENDED = 'ATTENDED',
  ABSENT = 'ABSENT',
  SUSPENDED = 'SUSPENDED', // Class cancelled
  EXCUSED = 'EXCUSED',
  HOLIDAY = 'HOLIDAY',
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

export interface EventGroup {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
}

export interface Stats {
  total: number;
  attended: number;
  absent: number;
  suspended: number;
  excused: number;
  pending: number;
  holiday: number;
  percentage: number;
  neededFor75: number;
}

export interface GroupedStats {
  [title: string]: Stats;
}

export interface AppMetadata {
  groups: EventGroup[];
  preferences: {
    filterTitle: string;
    showFrequency: boolean;
    isWorkingDaysExpanded: boolean;
    isHolidaysExpanded: boolean;
    isFrequencyExpanded: boolean;
  };
  version: string;
}