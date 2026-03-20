import React, { useState, useEffect, useMemo } from 'react';
import { CalendarEvent, AttendanceStatus, Stats, EventGroup } from './types';
import { parseICS } from './services/icsParser';
import { generateICS, generateCSV, downloadFile } from './services/exporter';
import { generateCalendarDays, formatDate, isSameDay, isToday } from './utils/dateUtils';
import { StatCard } from './components/StatCard';
import { EventModal } from './components/EventModal';
import { ConfirmModal } from './components/ConfirmModal';
import { GroupModal } from './components/GroupModal';
import { ImportChoiceModal } from './components/ImportChoiceModal';
import { StatisticsView } from './components/StatisticsView';
import {
  Calendar,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  UserX,
  FileSpreadsheet,
  AlertTriangle,
  Layers,
  Plus,
  Minus,
  Target,
  Clock,
  PartyPopper,
  Briefcase,
  RotateCcw
} from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay, differenceInCalendarDays } from 'date-fns';

import useLocalStorage from './hooks/useLocalStorage';

const App: React.FC = () => {
  const [events, setEvents] = useLocalStorage<CalendarEvent[]>('attenda_events', [], (stored) => {
    return Array.isArray(stored) ? stored.map((e: any) => ({
      ...e,
      start: new Date(e.start),
      end: new Date(e.end)
    })) : [];
  });

  const [groups, setGroups] = useLocalStorage<EventGroup[]>('attenda_groups', [], (stored) => {
    return Array.isArray(stored) ? stored.map((g: any) => ({
      ...g,
      startDate: new Date(g.startDate),
      endDate: new Date(g.endDate)
    })) : [];
  });

  const [currentDate, setCurrentDate] = useLocalStorage<Date>('attenda_currentDate', new Date(), (stored) => {
    return new Date(stored);
  });

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [highlightedSubject, setHighlightedSubject] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);

  const [filterTitle, setFilterTitle] = useLocalStorage<string>('attenda_filterTitle', 'All');
  const [isFrequencyExpanded, setIsFrequencyExpanded] = useLocalStorage<boolean>('attenda_frequencyExpanded', true);
  const [isWorkingDaysExpanded, setIsWorkingDaysExpanded] = useLocalStorage<boolean>('attenda_workingDaysExpanded', true);
  const [showFrequency, setShowFrequency] = useLocalStorage<boolean>('attenda_showFrequency', false);
  const [isHolidaysExpanded, setIsHolidaysExpanded] = useLocalStorage<boolean>('attenda_holidaysExpanded', true);
  const [isSidebarOpen, setIsSidebarOpen] = useLocalStorage<boolean>('attenda_sidebarOpen', true);
  const [zoomLevel, setZoomLevel] = useLocalStorage<number>('attenda_zoomLevel', 1);
  const [currentView, setCurrentView] = useState<'calendar' | 'statistics'>('calendar');

  const [pendingImport, setPendingImport] = useState<{ events: CalendarEvent[]; metadata?: any } | null>(null);

  // Confirmation Modal State
  const [confirmation, setConfirmation] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDangerous?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
    isDangerous: false,
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      const parsed = parseICS(content);

      if (parsed.metadata) {
        setPendingImport(parsed);
      } else {
        setEvents(prev => [...prev, ...parsed.events]);
      }
      setShowImport(false);
    };
    reader.readAsText(file);
  };

  const handleClearData = () => {
    setConfirmation({
      isOpen: true,
      title: 'Reset Data',
      message: 'Are you sure you want to delete all attendance records? This action cannot be undone.',
      isDangerous: true,
      onConfirm: () => setEvents([])
    });
  };

  const handleExportICS = () => {
    const metadata = {
      groups,
      preferences: {
        filterTitle,
        showFrequency,
        isWorkingDaysExpanded,
        isHolidaysExpanded,
        isFrequencyExpanded
      },
      version: '1.0'
    };
    const content = generateICS(events, metadata);
    downloadFile(`attenda-export-${format(new Date(), 'yyyy-MM-dd')}.ics`, content, 'text/calendar');
    setShowExport(false);
  };

  const handleExportCSV = () => {
    const content = generateCSV(events);
    downloadFile(`attenda-export-${format(new Date(), 'yyyy-MM-dd')}.csv`, content, 'text/csv');
    setShowExport(false);
  };

  const handleAddEvent = () => {
    const newEvent: CalendarEvent = {
      id: '',
      uid: crypto.randomUUID(),
      title: '',
      start: new Date(),
      end: new Date(new Date().getTime() + 60 * 60 * 1000), // 1 hour default
      status: AttendanceStatus.PENDING
    };
    setSelectedEvent(newEvent);
  };

  const handleQuickAdd = (e: React.MouseEvent, date: Date) => {
    e.stopPropagation();
    const start = new Date(date);
    start.setHours(9, 0, 0, 0); // Default 9 AM
    const end = new Date(date);
    end.setHours(10, 0, 0, 0); // Default 10 AM

    const newEvent: CalendarEvent = {
      id: '',
      uid: crypto.randomUUID(),
      title: '',
      start: start,
      end: end,
      status: AttendanceStatus.PENDING
    };
    setSelectedEvent(newEvent);
  };

  const handleSaveEvent = (savedEvent: CalendarEvent) => {
    if (savedEvent.id) {
      // Update existing
      setEvents(prev => prev.map(e => e.id === savedEvent.id ? savedEvent : e));
    } else {
      // Create new
      const newEvent = { ...savedEvent, id: crypto.randomUUID() };
      setEvents(prev => [...prev, newEvent]);
    }
    setSelectedEvent(null);
  };

  const handleDuplicateEvent = (eventToDuplicate: CalendarEvent) => {
    const newEvent = {
      ...eventToDuplicate,
      id: crypto.randomUUID(),
      uid: crypto.randomUUID(),
      title: `${eventToDuplicate.title} (Copy)`
    };
    setEvents(prev => [...prev, newEvent]);
    setSelectedEvent(null);
  };

  // ... existing code ...



  const handleAddGroup = (group: EventGroup) => {
    setGroups(prev => [...prev, group]);
  };

  const handleDeleteGroup = (id: string) => {
    setGroups(prev => prev.filter(g => g.id !== id));
  };

  const handleDeleteEvent = (eventToDelete: CalendarEvent) => {
    setConfirmation({
      isOpen: true,
      title: 'Delete Event',
      message: `Are you sure you want to delete "${eventToDelete.title}"? This action cannot be undone.`,
      isDangerous: true,
      onConfirm: () => {
        setEvents(prev => prev.filter(e => e.id !== eventToDelete.id));
        setSelectedEvent(null);
      }
    });
  };

  const handleMarkDayStatus = (e: React.MouseEvent, day: Date, status: AttendanceStatus) => {
    e.stopPropagation();
    e.preventDefault();

    const targetDate = day;
    const dayEvents = events.filter(ev => isSameDay(ev.start, targetDate));

    if (dayEvents.length === 0) return;

    const isAlreadyThisStatus = dayEvents.every(ev => ev.status === status);

    const modalConfig = {
      isOpen: true,
      title: isAlreadyThisStatus ? `Day Already marked ${status}` : `Mark Day as ${status}`,
      message: isAlreadyThisStatus
        ? `All events on ${formatDate(targetDate)} are already marked as ${status}.`
        : `Are you sure you want to mark all ${dayEvents.length} events on ${formatDate(targetDate)} as ${status}?`,
      isDangerous: status === AttendanceStatus.ABSENT,
      onConfirm: () => {
        setEvents(prevEvents => prevEvents.map(ev => {
          if (isSameDay(ev.start, targetDate)) {
            return { ...ev, status: status };
          }
          return ev;
        }));
      }
    };

    if (status === AttendanceStatus.PENDING) {
      modalConfig.title = "Clear Attendance Status";
      modalConfig.message = `Are you sure you want to clear the attendance status for all ${dayEvents.length} events on ${formatDate(targetDate)}?`;
      modalConfig.isDangerous = false;
    }

    setConfirmation(modalConfig);
  };

  const calendarDays = useMemo(() => generateCalendarDays(currentDate), [currentDate]);

  const calculateStats = (filteredEvents: CalendarEvent[]): Stats => {
    let total = 0;
    let attended = 0;
    let absent = 0;
    let suspended = 0;
    let excused = 0;
    let pending = 0;
    let holiday = 0;

    filteredEvents.forEach(e => {
      if (e.status === AttendanceStatus.HOLIDAY) {
        holiday++;
        return;
      }
      if (e.status === AttendanceStatus.SUSPENDED) {
        suspended++;
        return;
      }
      if (e.status === AttendanceStatus.EXCUSED) {
        excused++;
        return;
      }
      if (e.status === AttendanceStatus.ATTENDED) attended++;
      else if (e.status === AttendanceStatus.ABSENT) absent++;
      else pending++;
    });

    total = attended + absent;
    const percentage = total === 0 ? 0 : (attended / total) * 100;
    const neededRaw = (3 * total) - (4 * attended);
    const neededFor75 = neededRaw > 0 ? neededRaw : 0;

    return { total, attended, absent, suspended, excused, pending, holiday, percentage, neededFor75 };
  };

  const uniqueTitles = useMemo(() => Array.from(new Set(events.map(e => e.title))), [events]);

  const currentStats = useMemo(() => {
    const subset = filterTitle === 'All' ? events : events.filter(e => e.title === filterTitle);
    return calculateStats(subset);
  }, [events, filterTitle]);

  const currentMonthStats = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const monthSubset = events.filter(e =>
      isWithinInterval(e.start, { start, end }) &&
      (filterTitle === 'All' || e.title === filterTitle)
    );
    return calculateStats(monthSubset);
  }, [events, currentDate, filterTitle]);

  const holidayEvents = useMemo(() => {
    return events.filter(e => e.status === AttendanceStatus.HOLIDAY)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }, [events]);

  const groupsWithCounts = useMemo(() => {
    return groups.map(group => {
      const groupEvents = events.filter(e =>
        isWithinInterval(e.start, {
          start: startOfDay(group.startDate),
          end: endOfDay(group.endDate)
        })
      );
      const groupStats = calculateStats(groupEvents);
      const daysCount = Math.abs(differenceInCalendarDays(group.endDate, group.startDate)) + 1;

      return {
        ...group,
        count: groupEvents.length,
        stats: groupStats,
        daysCount
      };
    });
  }, [groups, events]);

  const subjectFrequencies = useMemo(() => {
    const counts = events.reduce((acc, event) => {
      const title = event.title || 'Unknown';
      acc[title] = (acc[title] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts).sort(([, a], [, b]) => b - a);
  }, [events]);

  const subjectAnalysis = useMemo(() => {
    const statsBySubject = events.reduce((acc, event) => {
      const title = event.title || 'Unknown';
      if (!acc[title]) {
        acc[title] = { attended: 0, absent: 0, holiday: 0, suspended: 0, excused: 0, pending: 0 };
      }

      const s = acc[title];
      if (event.status === AttendanceStatus.ATTENDED) s.attended++;
      else if (event.status === AttendanceStatus.ABSENT) s.absent++;
      else if (event.status === AttendanceStatus.HOLIDAY) s.holiday++;
      else if (event.status === AttendanceStatus.SUSPENDED) s.suspended++;
      else if (event.status === AttendanceStatus.EXCUSED) s.excused++;
      else s.pending++;

      return acc;
    }, {} as Record<string, { attended: number; absent: number; holiday: number; suspended: number; excused: number; pending: number }>);

    return Object.entries(statsBySubject)
      .filter(([_, s]) => (s.attended + s.absent + s.suspended + s.excused + s.pending) > 0)
      .map(([title, s]) => {
        const rawTotal = s.attended + s.absent + s.holiday + s.excused; // Total excluding suspended
        const frequency = rawTotal + s.pending; // Total including pending

        return { title, attended: s.attended, total: rawTotal, frequency };
      })
      .sort((a, b) => b.total - a.total);
  }, [events]);

  const handleConfirmImport = (includeMetadata: boolean) => {
    if (!pendingImport) return;

    setEvents(prev => [...prev, ...pendingImport.events]);

    if (includeMetadata && pendingImport.metadata) {
      if (pendingImport.metadata.groups) {
        setGroups(pendingImport.metadata.groups);
      }
      if (pendingImport.metadata.preferences) {
        setFilterTitle(pendingImport.metadata.preferences.filterTitle);
        setShowFrequency(pendingImport.metadata.preferences.showFrequency);
        setIsWorkingDaysExpanded(pendingImport.metadata.preferences.isWorkingDaysExpanded);
        setIsHolidaysExpanded(pendingImport.metadata.preferences.isHolidaysExpanded);
        setIsFrequencyExpanded(pendingImport.metadata.preferences.isFrequencyExpanded);
      }
    }
    setPendingImport(null);
  };

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.1, 1.5));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.1, 0.5));
  const handleZoomReset = () => setZoomLevel(1);

  // Apply zoom via root font size
  useEffect(() => {
    document.documentElement.style.fontSize = `${Math.round(zoomLevel * 16)}px`;
  }, [zoomLevel]);

  return (
    <div className="app-root">
      {pendingImport && (
        <ImportChoiceModal
          isOpen={!!pendingImport}
          onImportEventsOnly={() => handleConfirmImport(false)}
          onImportEverything={() => handleConfirmImport(true)}
          onClose={() => setPendingImport(null)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${!isSidebarOpen ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-area" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <div className="logo-icon">
              <Calendar size={24} />
            </div>
            <h1 className="logo-text">Attenda</h1>
          </div>
        </div>

        {!isSidebarOpen && (
          <div className="collapsed-nav" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginTop: '2rem',
            gap: '1rem',
            width: '100%'
          }}>
            <button
              onClick={() => setCurrentView('calendar')}
              title="Calendar"
              style={{
                background: currentView === 'calendar' ? 'var(--primary-light)' : 'transparent',
                color: currentView === 'calendar' ? 'var(--primary)' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: '8px',
                padding: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
            >
              <Calendar size={20} />
            </button>
            <button
              onClick={() => setCurrentView('statistics')}
              title="Statistics"
              style={{
                background: currentView === 'statistics' ? 'var(--primary-light)' : 'transparent',
                color: currentView === 'statistics' ? 'var(--primary)' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: '8px',
                padding: '0.75rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
            >
              <FileSpreadsheet size={20} />
            </button>

            <div style={{ width: '100%', height: '1px', background: 'var(--border)', margin: '0.5rem 0' }} />

            {/* Collapsed Zoom Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
              <button onClick={handleZoomIn} title="Zoom In" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><Plus size={16} /></button>
              <span style={{ fontSize: '0.7rem', fontWeight: 'bold' }}>{Math.round(zoomLevel * 100)}%</span>
              <button onClick={handleZoomOut} title="Zoom Out" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}><Minus size={16} /></button>
            </div>
          </div>
        )}

        <div className="sidebar-content">

          {/* Main Actions */}
          <div className="section-group">
            <div className="actions-grid">
              <button onClick={handleAddEvent} className="btn-card" style={{ gridColumn: '1 / -1', background: 'var(--primary)', color: 'white', justifyContent: 'center' }}>
                <Plus size={20} />
                <span className="btn-label" style={{ color: 'white' }}>Add New Event</span>
              </button>
              <button onClick={() => setShowImport(!showImport)} className="btn-card">
                <Upload size={20} />
                <span className="btn-label">Import ICS</span>
              </button>
              <button onClick={handleClearData} className="btn-card danger">
                <Trash2 size={20} />
                <span className="btn-label">Reset Data</span>
              </button>
            </div>

            {showImport && (
              <div className="import-panel">
                <p className="import-text">Select .ics file</p>
                <input type="file" accept=".ics" onChange={handleFileUpload} className="file-input" />
              </div>
            )}

            <div>
              <button onClick={() => setShowExport(!showExport)} className="export-btn">
                <Download size={18} />
                <span>Export Data</span>
              </button>

              {showExport && (
                <div className="export-options">
                  <button onClick={handleExportICS} className="btn-small">
                    <Calendar size={16} />
                    ICS Calendar
                  </button>
                  <button onClick={handleExportCSV} className="btn-small">
                    <FileSpreadsheet size={16} />
                    Table (CSV)
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="section-group">
            <div className="section-label">
              <Filter size={14} />
              <span>Filter Subject</span>
            </div>
            <select
              value={filterTitle}
              onChange={(e) => setFilterTitle(e.target.value)}
              className="select-input"
            >
              <option value="All">All Subjects</option>
              {uniqueTitles.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Working Days Analysis */}
          <div className="section-group">
            <div
              className="section-label"
              style={{ justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={() => setIsWorkingDaysExpanded(!isWorkingDaysExpanded)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Briefcase size={14} />
                <span>Working Days Analysis</span>
              </div>
              {isWorkingDaysExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>



            {isWorkingDaysExpanded && (
              <div className="group-list">
                {/* Frequency Toggle */}
                <div
                  className="group-card"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem',
                    cursor: 'pointer',
                    marginBottom: '0.5rem'
                  }}
                  onClick={() => setShowFrequency(!showFrequency)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div
                      style={{
                        width: '32px',
                        height: '18px',
                        background: showFrequency ? 'var(--primary)' : 'var(--neutral-dark)',
                        borderRadius: '10px',
                        position: 'relative',
                        transition: 'background 0.2s'
                      }}
                    >
                      <div
                        style={{
                          width: '14px',
                          height: '14px',
                          background: 'white',
                          borderRadius: '50%',
                          position: 'absolute',
                          top: '2px',
                          left: showFrequency ? '16px' : '2px',
                          transition: 'left 0.2s'
                        }}
                      />
                    </div>
                    <span className="group-card-name" style={{ fontSize: '0.8rem' }}>Show Frequency</span>
                  </div>
                </div>

                {subjectAnalysis.map(stat => {
                  const percentage = stat.total > 0 ? (stat.attended / stat.total) * 100 : 0;
                  const color = percentage >= 75 ? 'var(--success)' : '#eab308'; // Yellow for < 75%

                  return (
                    <div
                      key={stat.title}
                      className="group-card"
                      onClick={() => setHighlightedSubject(prev => prev === stat.title ? null : stat.title)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.5rem 0.75rem',
                        cursor: 'pointer',
                        background: highlightedSubject === stat.title ? 'var(--neutral-light)' : 'transparent',
                        border: highlightedSubject === stat.title ? '1px solid var(--primary)' : '1px solid transparent'
                      }}
                    >
                      <span className="group-card-name" style={{ fontSize: '0.8rem', maxWidth: '60%', color: percentage < 75 ? '#eab308' : 'inherit' }}>
                        {stat.title}
                      </span>
                      <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                        <span style={{ color: color }}>{stat.attended}</span>
                        <span style={{ margin: '0 2px' }}>/</span>
                        <span>{stat.total}</span>
                        {showFrequency && (
                          <>
                            <span style={{ margin: '0 2px', opacity: 0.5 }}>/</span>
                            <span style={{ color: 'var(--primary)', opacity: 0.8 }}>{stat.frequency}</span>
                          </>
                        )}
                      </span>
                    </div>
                  );
                })}

                {/* Grand Total */}
                <div
                  className="group-card"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    background: 'var(--neutral-light)',
                    marginTop: '0.25rem'
                  }}
                >
                  <span className="group-card-name" style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                    Total
                  </span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                    <span style={{
                      color: (() => {
                        const att = subjectAnalysis.reduce((acc, curr) => acc + curr.attended, 0);
                        const tot = subjectAnalysis.reduce((acc, curr) => acc + curr.total, 0);
                        const pct = tot > 0 ? (att / tot) * 100 : 0;
                        return pct >= 75 ? 'var(--success)' : '#eab308';
                      })()
                    }}>
                      {subjectAnalysis.reduce((acc, curr) => acc + curr.attended, 0)}
                    </span>
                    <span style={{ margin: '0 2px' }}>/</span>
                    <span>
                      {subjectAnalysis.reduce((acc, curr) => acc + curr.total, 0)}
                    </span>
                    {showFrequency && (
                      <>
                        <span style={{ margin: '0 2px', opacity: 0.5 }}>/</span>
                        <span style={{ color: 'var(--primary)', opacity: 0.8 }}>
                          {subjectAnalysis.reduce((acc, curr) => acc + curr.frequency, 0)}
                        </span>
                      </>
                    )}
                  </span>
                </div>
                <div className="stats-footer">
                  Total Valid Classes: {currentStats.total}
                </div>
              </div>
            )}
          </div>

          {/* Event Groups Management */}
          <div className="section-group">
            <div className="section-label" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={14} />
                <span>Event Groups</span>
              </div>
              <button
                onClick={() => setShowGroupModal(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 0 }}
              >
                <Plus size={16} />
              </button>
            </div>

            <div className="group-list">
              {groupsWithCounts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--neutral-light)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  No groups created.
                </div>
              ) : (
                groupsWithCounts.map(group => (
                  <div key={group.id} className="group-card">
                    <div className="group-card-header">
                      <span className="group-card-name">{group.name}</span>
                      <button
                        className="btn-delete-group"
                        onClick={() => handleDeleteGroup(group.id)}
                        title="Remove Group"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <span className="group-card-dates">
                      {format(group.startDate, 'MMM d')} - {format(group.endDate, 'MMM d, yyyy')}
                    </span>

                    <div className="group-card-footer" style={{ flexWrap: 'wrap' }}>
                      <div className="group-card-count" title="Total Events">
                        {group.count} {group.count === 1 ? 'Event' : 'Events'}
                      </div>
                      <div className="group-card-count" style={{ background: '#fefce8', color: '#ca8a04' }} title="Day count">
                        <Clock size={10} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                        {group.daysCount} {group.daysCount === 1 ? 'Day' : 'Days'}
                      </div>
                      {group.stats.total > 0 && (
                        <div
                          className="group-card-count"
                          style={{
                            background: group.stats.percentage >= 75 ? 'var(--success-light)' : 'var(--danger-light)',
                            color: group.stats.percentage >= 75 ? 'var(--success)' : 'var(--danger)',
                            fontWeight: 'bold'
                          }}
                        >
                          {group.stats.percentage.toFixed(0)}%
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Holiday Section */}
          <div className="section-group">
            <div
              className="section-label"
              style={{ justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={() => setIsHolidaysExpanded(!isHolidaysExpanded)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PartyPopper size={14} />
                <span>Holidays & Festivals</span>
              </div>
              {isHolidaysExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </div>

            {isHolidaysExpanded && (
              <div className="group-list">
                {holidayEvents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1rem', background: 'var(--neutral-light)', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    No holidays recorded.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '150px', overflowY: 'auto', paddingRight: '0.5rem', position: 'relative' }}>
                    <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-white)', paddingBottom: '0.25rem', paddingTop: '0.25rem' }}>
                      <div className="group-card-count" style={{ alignSelf: 'start', background: 'var(--holiday-light)', color: 'var(--holiday)', display: 'inline-flex' }}>
                        Total: {holidayEvents.length} Days Off
                      </div>
                    </div>
                    {Array.from(new Set(holidayEvents.map(h => h.title))).map(title => {
                      const firstDate = holidayEvents.find(h => h.title === title)?.start;
                      return (
                        <div key={title} className="holiday-item">
                          <div className="holiday-dot"></div>
                          <div className="holiday-info">
                            <span className="holiday-name">{title}</span>
                            <span className="holiday-date">{firstDate ? format(firstDate, 'MMM d') : ''}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Stats Overview */}
          <div className="stats-container">
            <div className="section-label">
              <TrendingUp size={14} />
              <span>Overall Analytics</span>
            </div>

            <StatCard
              label="Attendance Rate"
              value={`${currentStats.percentage.toFixed(1)}%`}
              subtext={currentStats.percentage < 75 ? 'Below Requirement' : 'Good Standing'}
              color={currentStats.percentage >= 75 ? 'green' : 'red'}
              icon={currentStats.percentage >= 75 ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            />

            <div className="stats-grid">
              <StatCard label="Attended" value={currentStats.attended} color="blue" />
              <StatCard label="Absent" value={currentStats.absent} color="red" />
            </div>

            <StatCard
              label="For 75%"
              value={currentStats.neededFor75 > 0 ? `+${currentStats.neededFor75} classes` : 'Target Met'}
              subtext={currentStats.neededFor75 > 0 ? 'Consecutive attendance needed' : 'Keep it up!'}
              color="yellow"
            />

            <div className="stats-footer">
              Total Valid Classes: {currentStats.total}
            </div>

            <button
              onClick={() => setCurrentView('statistics')}
              className="btn-card"
              style={{ width: '100%', marginTop: '1rem', flexDirection: 'row', background: currentView === 'statistics' ? 'var(--primary-light)' : 'white' }}
            >
              <FileSpreadsheet size={18} />
              <span className="btn-label">Statistics</span>
            </button>
            <button
              onClick={() => setCurrentView('calendar')}
              className="btn-card"
              style={{ width: '100%', marginTop: '0.5rem', flexDirection: 'row', background: currentView === 'calendar' ? 'var(--primary-light)' : 'white' }}
            >
              <Calendar size={18} />
              <span className="btn-label">Calendar</span>
            </button>
          </div>

          {/* Zoom Controls (Expanded) */}
          <div className="section-group" style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>UI Scale</span>
              <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--primary)' }}>{Math.round(zoomLevel * 100)}%</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button onClick={handleZoomOut} className="btn-card" style={{ flex: 1, padding: '0.5rem', flexDirection: 'row' }}>
                <Minus size={14} />
              </button>
              <button onClick={handleZoomReset} className="btn-card" style={{ flex: 1, padding: '0.5rem', fontSize: '0.8rem' }}>
                Reset
              </button>
              <button onClick={handleZoomIn} className="btn-card" style={{ flex: 1, padding: '0.5rem', flexDirection: 'row' }}>
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>

      </aside >

      {/* Main Calendar Area */}
      {
        currentView === 'calendar' ? (
          <main className="main-view">
            <div className="header-row">
              <div className="header-titles">
                <h2 className="month-title">
                  {format(currentDate, 'MMMM yyyy')}
                </h2>

                {currentMonthStats.total > 0 && (
                  <div className={`status-indicator ${currentMonthStats.percentage < 75 ? 'risk' : 'safe'}`}>
                    {currentMonthStats.percentage < 75 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                    <span>
                      Month Status: {currentMonthStats.percentage.toFixed(1)}%
                      {currentMonthStats.percentage < 75 && ' (At Risk)'}
                    </span>
                  </div>
                )}
              </div>

              <div className="nav-group">
                <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="nav-btn">
                  <ChevronLeft size={24} />
                </button>
                <button onClick={() => setCurrentDate(new Date())} className="btn-today">
                  Today
                </button>
                <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="nav-btn">
                  <ChevronRight size={24} />
                </button>
              </div>
            </div>

            <div className="calendar-card">
              <div className="days-header">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="day-head">{day}</div>
                ))}
              </div>

              <div className="days-body">
                {calendarDays.map((day, idx) => {
                  const dayEvents = events.filter(e => isSameDay(e.start, day));
                  const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                  const dayStats = calculateStats(dayEvents);
                  const isDayAtRisk = dayStats.total > 0 && dayStats.percentage < 75;

                  return (
                    <div
                      key={day.toISOString()}
                      className={`day-cell ${!isCurrentMonth ? 'other-month' : ''} ${isToday(day) ? 'today' : ''} ${isDayAtRisk ? 'at-risk' : ''}`}
                    >
                      <div className="day-header">
                        <div className="date-group">
                          <span className="date-num">{format(day, 'd')}</span>
                          {isDayAtRisk && (
                            <span title="Daily attendance < 75%" className="risk-icon">
                              <AlertCircle size={12} />
                            </span>
                          )}
                        </div>

                        {dayEvents.length > 0 && (
                          <div className="cell-actions">
                            <button
                              type="button"
                              onClick={(e) => handleMarkDayStatus(e, day, AttendanceStatus.ATTENDED)}
                              className="mark-day-btn attended"
                              title="Mark entire day as Attended"
                            >
                              <CheckCircle2 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleMarkDayStatus(e, day, AttendanceStatus.HOLIDAY)}
                              className="mark-day-btn holiday"
                              title="Mark entire day as Holiday"
                            >
                              <PartyPopper size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleMarkDayStatus(e, day, AttendanceStatus.ABSENT)}
                              className="mark-day-btn absent"
                              title="Mark entire day absent"
                            >
                              <UserX size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleMarkDayStatus(e, day, AttendanceStatus.PENDING)}
                              className="mark-day-btn"
                              title="Clear Status (Reset)"
                            >
                              <RotateCcw size={14} />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="events-list">
                        {dayEvents.map(event => {
                          const displayTitle = event.isOverride && event.overrideTitle ? event.overrideTitle : event.title;
                          const isHighlighted = highlightedSubject === event.title;
                          return (
                            <button
                              key={event.id}
                              onClick={() => setSelectedEvent(event)}
                              className={`event-item status-${event.status}`}
                              style={isHighlighted ? {
                                boxShadow: '0 0 0 2px var(--text-primary)',
                                zIndex: 10,
                                transform: 'scale(1.05)',
                                transition: 'all 0.2s ease'
                              } : undefined}
                            >
                              <span className="event-title">{displayTitle}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </main>
        ) : (
          <StatisticsView
            events={events}
            subjectAnalysis={subjectAnalysis}
            highlightedSubject={highlightedSubject}
            setHighlightedSubject={setHighlightedSubject}
          />
        )
      }


      {
        selectedEvent && (
          <EventModal
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onSave={handleSaveEvent}
            onDelete={handleDeleteEvent}
            onDuplicate={handleDuplicateEvent}
          />
        )
      }

      {/* Reusable Confirm Modal */}
      <ConfirmModal
        isOpen={confirmation.isOpen}
        title={confirmation.title}
        message={confirmation.message}
        onClose={() => setConfirmation({ ...confirmation, isOpen: false })}
        onConfirm={() => {
          confirmation.onConfirm();
          setConfirmation({ ...confirmation, isOpen: false });
        }}
        isDangerous={confirmation.isDangerous}
      />

      {/* Group Management Modal */}
      <GroupModal
        isOpen={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        onSave={(group) => {
          handleAddGroup(group);
          setShowGroupModal(false);
        }}
      />
    </div >
  );
};

export default App;