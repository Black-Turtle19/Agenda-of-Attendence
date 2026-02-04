import React, { useState, useEffect, useMemo } from 'react';
import { CalendarEvent, AttendanceStatus, Stats, GroupedStats } from './types';
import { parseICS } from './services/icsParser';
import { generateCalendarDays, formatDate, isSameDay, isToday } from './utils/dateUtils';
import { StatCard } from './components/StatCard';
import { EventModal } from './components/EventModal';
import { 
  Calendar, 
  Upload, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  TrendingUp,
  Download,
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';

const App: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [filterTitle, setFilterTitle] = useState<string>('All');

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('attenda_events');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Fix dates converted to string by JSON
        const fixed = parsed.map((e: any) => ({
          ...e,
          start: new Date(e.start),
          end: new Date(e.end)
        }));
        setEvents(fixed);
      } catch (e) {
        console.error("Failed to load events", e);
      }
    }
  }, []);

  // Save to local storage on change
  useEffect(() => {
    localStorage.setItem('attenda_events', JSON.stringify(events));
  }, [events]);

  // Handlers
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      const parsedEvents = parseICS(content);
      setEvents(prev => {
        // Simple merge: Avoid duplicates by ID if possible, or just append
        // Ideally we'd clear or ask user. For now, we append/replace.
        return [...prev, ...parsedEvents];
      });
      setShowImport(false);
    };
    reader.readAsText(file);
  };

  const handleClearData = () => {
    if (window.confirm("Are you sure you want to delete all attendance records?")) {
      setEvents([]);
    }
  };

  const handleUpdateEvent = (updated: CalendarEvent) => {
    setEvents(events.map(e => e.id === updated.id ? updated : e));
    setSelectedEvent(null);
  };

  const calendarDays = useMemo(() => generateCalendarDays(currentDate), [currentDate]);

  // --- Statistics Logic ---
  const calculateStats = (filteredEvents: CalendarEvent[]): Stats => {
    let total = 0;
    let attended = 0;
    let absent = 0;
    let suspended = 0;
    let excused = 0;
    let pending = 0;

    filteredEvents.forEach(e => {
      if (e.status === AttendanceStatus.SUSPENDED) {
        suspended++;
        return; // Doesn't count to total denominator usually
      }
      
      if (e.status === AttendanceStatus.EXCUSED) {
        excused++;
        return; // Doesn't count? Or counts as attended? Let's say doesn't count.
      }

      if (e.status === AttendanceStatus.ATTENDED) attended++;
      else if (e.status === AttendanceStatus.ABSENT) absent++;
      else pending++;
    });

    total = attended + absent; // Valid classes that happened
    const percentage = total === 0 ? 0 : (attended / total) * 100;

    // 75% Calculation
    // (Attended + X) / (Total + X) >= 0.75
    // X >= 3*Total - 4*Attended
    const neededRaw = (3 * total) - (4 * attended);
    const neededFor75 = neededRaw > 0 ? neededRaw : 0;

    return { total, attended, absent, suspended, excused, pending, percentage, neededFor75 };
  };

  const uniqueTitles = useMemo(() => Array.from(new Set(events.map(e => e.title))), [events]);
  
  const currentStats = useMemo(() => {
    const subset = filterTitle === 'All' ? events : events.filter(e => e.title === filterTitle);
    return calculateStats(subset);
  }, [events, filterTitle]);

  const monthEvents = useMemo(() => {
    // Optimization: Filter events only for this month view rendering
    // Though for small datasets filtering in render is fine.
    return events;
  }, [events]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 font-sans text-slate-900">
      
      {/* Sidebar / Header (Responsive) */}
      <aside className="w-full md:w-80 bg-white border-r border-slate-200 flex flex-col z-10 shadow-lg md:h-screen sticky top-0 md:fixed">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <Calendar size={24} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Attenda</h1>
          </div>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-8">
          
          {/* Main Actions */}
          <div className="grid grid-cols-2 gap-3">
             <button 
              onClick={() => setShowImport(!showImport)}
              className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50 transition-all text-slate-600 hover:text-blue-600 gap-2"
             >
               <Upload size={20} />
               <span className="text-xs font-semibold">Import ICS</span>
             </button>
             <button 
              onClick={handleClearData}
              className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-200 hover:border-red-200 hover:bg-red-50 transition-all text-slate-600 hover:text-red-600 gap-2"
             >
               <Trash2 size={20} />
               <span className="text-xs font-semibold">Reset Data</span>
             </button>
          </div>

          {showImport && (
            <div className="animate-in fade-in slide-in-from-top-2 p-4 bg-slate-100 rounded-lg text-sm">
              <p className="mb-2 font-medium">Select .ics file</p>
              <input type="file" accept=".ics" onChange={handleFileUpload} className="w-full text-xs" />
            </div>
          )}

          {/* Filters */}
          <div>
            <div className="flex items-center gap-2 mb-3 text-slate-400">
              <Filter size={14} />
              <span className="text-xs font-bold uppercase tracking-wider">Filter Subject</span>
            </div>
            <select 
              value={filterTitle} 
              onChange={(e) => setFilterTitle(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="All">All Subjects</option>
              {uniqueTitles.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Stats Overview */}
          <div className="space-y-4">
             <div className="flex items-center gap-2 mb-1 text-slate-400">
              <TrendingUp size={14} />
              <span className="text-xs font-bold uppercase tracking-wider">Analytics</span>
            </div>
            
            <StatCard 
              label="Attendance Rate" 
              value={`${currentStats.percentage.toFixed(1)}%`} 
              subtext={currentStats.percentage < 75 ? 'Below Requirement' : 'Good Standing'}
              color={currentStats.percentage >= 75 ? 'green' : 'red'}
              icon={currentStats.percentage >= 75 ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            />

            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Attended" value={currentStats.attended} color="blue" />
              <StatCard label="Absent" value={currentStats.absent} color="red" />
            </div>
            
             <StatCard 
              label="For 75%" 
              value={currentStats.neededFor75 > 0 ? `+${currentStats.neededFor75} classes` : 'Target Met'} 
              subtext={currentStats.neededFor75 > 0 ? 'Consecutive attendance needed' : 'Keep it up!'}
              color="yellow"
            />
             
             <div className="pt-2 text-xs text-slate-400 text-center">
               Total Valid Classes: {currentStats.total}
             </div>
          </div>
        </div>
      </aside>

      {/* Main Calendar Area */}
      <main className="flex-1 md:ml-80 p-4 md:p-8 h-screen overflow-y-auto">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-bold text-slate-800">
            {format(currentDate, 'MMMM yyyy')}
          </h2>
          <div className="flex gap-2">
            <button 
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-2 rounded-full hover:bg-white hover:shadow-md transition-all text-slate-600"
            >
              <ChevronLeft size={24} />
            </button>
            <button 
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-2 text-sm font-semibold rounded-full bg-white shadow-sm border border-slate-200 hover:bg-slate-50 transition-all"
            >
              Today
            </button>
            <button 
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-2 rounded-full hover:bg-white hover:shadow-md transition-all text-slate-600"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Days Header */}
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-widest">
                {day}
              </div>
            ))}
          </div>
          
          {/* Days Grid */}
          <div className="grid grid-cols-7 auto-rows-fr">
            {calendarDays.map((day, idx) => {
              // Filter events for this day
              const dayEvents = monthEvents.filter(e => isSameDay(e.start, day));
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              
              return (
                <div 
                  key={day.toISOString()} 
                  className={`
                    min-h-[120px] p-2 border-b border-r border-slate-100 relative group transition-colors
                    ${!isCurrentMonth ? 'bg-slate-50/30' : 'bg-white'}
                    ${isToday(day) ? 'bg-blue-50/30' : ''}
                  `}
                >
                  <div className={`text-xs font-medium mb-2 ${isToday(day) ? 'text-blue-600 bg-blue-100 inline-block px-2 py-0.5 rounded-full' : 'text-slate-400'}`}>
                    {format(day, 'd')}
                  </div>
                  
                  <div className="space-y-1.5">
                    {dayEvents.map(event => {
                      // Style based on status
                      let statusStyle = 'bg-blue-100 text-blue-700 border-blue-200';
                      if (event.status === AttendanceStatus.ATTENDED) statusStyle = 'bg-green-100 text-green-700 border-green-200';
                      if (event.status === AttendanceStatus.ABSENT) statusStyle = 'bg-red-100 text-red-700 border-red-200 line-through decoration-red-400';
                      if (event.status === AttendanceStatus.SUSPENDED) statusStyle = 'bg-slate-100 text-slate-500 border-slate-200 opacity-60';
                      if (event.status === AttendanceStatus.EXCUSED) statusStyle = 'bg-yellow-100 text-yellow-700 border-yellow-200';
                      
                      const displayTitle = event.isOverride && event.overrideTitle ? event.overrideTitle : event.title;

                      return (
                        <button
                          key={event.id}
                          onClick={() => setSelectedEvent(event)}
                          className={`
                            w-full text-left px-2 py-1.5 rounded-md text-[10px] sm:text-xs font-medium border truncate transition-all hover:scale-[1.02] hover:shadow-sm
                            ${statusStyle}
                          `}
                        >
                          <div className="flex items-center justify-between">
                             <span className="truncate">{displayTitle}</span>
                          </div>
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
      
      {/* Modal Layer */}
      {selectedEvent && (
        <EventModal 
          event={selectedEvent} 
          onClose={() => setSelectedEvent(null)} 
          onSave={handleUpdateEvent} 
        />
      )}
    </div>
  );
};

export default App;
