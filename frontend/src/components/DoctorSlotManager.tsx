import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Calendar,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  Save,
  RefreshCw,
  Sparkles,
  Layers,
  X,
  AlertTriangle,
  RotateCcw,
  Sliders
} from 'lucide-react';
import { api } from '../services/api';

export interface ShiftConfig {
  id: string;
  start_time: string; // "13:00"
  end_time: string;   // "15:00"
  slot_duration_minutes: number; // 15, 30, etc.
}

export interface DaySchedule {
  weekday: number; // 0=Mon ... 6=Sun
  name: string;
  short: string;
  is_active: boolean;
  shifts: ShiftConfig[];
}

const WEEKDAYS = [
  { weekday: 0, name: 'Monday', short: 'Mon' },
  { weekday: 1, name: 'Tuesday', short: 'Tue' },
  { weekday: 2, name: 'Wednesday', short: 'Wed' },
  { weekday: 3, name: 'Thursday', short: 'Thu' },
  { weekday: 4, name: 'Friday', short: 'Fri' },
  { weekday: 5, name: 'Saturday', short: 'Sat' },
  { weekday: 6, name: 'Sunday', short: 'Sun' },
];

const PRESET_INTERVALS = [
  { label: '01:00 PM – 03:00 PM', start: '13:00', end: '15:00', desc: 'Afternoon Shift' },
  { label: '09:00 AM – 01:00 PM', start: '09:00', end: '13:00', desc: 'Morning Shift' },
  { label: '04:00 PM – 08:00 PM', start: '16:00', end: '20:00', desc: 'Evening Shift' },
  { label: '10:00 AM – 06:00 PM', start: '10:00', end: '18:00', desc: 'Full Day' },
];

const DURATION_OPTIONS = [
  { value: 10, label: '10 mins (Quick Triage / Check)' },
  { value: 15, label: '15 mins (Express / Follow-up)' },
  { value: 20, label: '20 mins (Standard Consult)' },
  { value: 30, label: '30 mins (Recommended Standard)' },
  { value: 45, label: '45 mins (Comprehensive Exam)' },
  { value: 60, label: '60 mins (Procedure / Deep Consult)' },
];

// Helper to convert "13:30" -> "01:30 PM"
function formatTo12Hour(time24: string): string {
  if (!time24 || !time24.includes(':')) return time24;
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return time24;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12; // 0 becomes 12
  const formattedH = h < 10 ? `0${h}` : `${h}`;
  const formattedM = m < 10 ? `0${m}` : `${m}`;
  return `${formattedH}:${formattedM} ${ampm}`;
}

// Generate slot intervals between start_time and end_time
function calculateSlots(startTime: string, endTime: string, durationMinutes: number): { start: string; end: string }[] {
  if (!startTime || !endTime || durationMinutes <= 0) return [];
  const [sH, sM] = startTime.split(':').map(Number);
  const [eH, eM] = endTime.split(':').map(Number);
  if (isNaN(sH) || isNaN(sM) || isNaN(eH) || isNaN(eM)) return [];

  const startMinutes = sH * 60 + sM;
  const endMinutes = eH * 60 + eM;
  if (startMinutes >= endMinutes) return [];

  const slots: { start: string; end: string }[] = [];
  let current = startMinutes;

  while (current + durationMinutes <= endMinutes) {
    const next = current + durationMinutes;
    const curH = Math.floor(current / 60);
    const curM = current % 60;
    const nextH = Math.floor(next / 60);
    const nextM = next % 60;

    const slotStartStr = `${String(curH).padStart(2, '0')}:${String(curM).padStart(2, '0')}`;
    const slotEndStr = `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`;

    slots.push({ start: slotStartStr, end: slotEndStr });
    current = next;
  }

  return slots;
}

// Validate individual day shifts (overlap, interval vs duration, bounds)
function getDayValidationErrors(day: DaySchedule): { shiftIndex: number; message: string }[] {
  const errors: { shiftIndex: number; message: string }[] = [];
  if (!day.is_active || day.shifts.length === 0) return errors;

  day.shifts.forEach((s, idx) => {
    if (!s.start_time || !s.end_time) {
      errors.push({ shiftIndex: idx, message: 'Start and End times are required.' });
      return;
    }
    if (s.start_time >= s.end_time) {
      errors.push({ shiftIndex: idx, message: `Start time (${formatTo12Hour(s.start_time)}) must be earlier than End time (${formatTo12Hour(s.end_time)}).` });
      return;
    }
    const [sH, sM] = s.start_time.split(':').map(Number);
    const [eH, eM] = s.end_time.split(':').map(Number);
    const diff = (eH * 60 + eM) - (sH * 60 + sM);
    if (diff < s.slot_duration_minutes) {
      errors.push({
        shiftIndex: idx,
        message: `Interval is only ${diff} mins, but slot duration is ${s.slot_duration_minutes} mins. At least 1 slot must fit.`
      });
    }
  });

  // Check overlaps between multiple shifts on the same day
  if (day.shifts.length > 1) {
    for (let i = 0; i < day.shifts.length; i++) {
      for (let j = i + 1; j < day.shifts.length; j++) {
        const s1 = day.shifts[i];
        const s2 = day.shifts[j];
        if (s1.start_time < s2.end_time && s2.start_time < s1.end_time) {
          errors.push({
            shiftIndex: j,
            message: `Shift #${j + 1} (${formatTo12Hour(s2.start_time)}–${formatTo12Hour(s2.end_time)}) overlaps with Shift #${i + 1} (${formatTo12Hour(s1.start_time)}–${formatTo12Hour(s1.end_time)}).`
          });
        }
      }
    }
  }

  return errors;
}

interface DoctorSlotManagerProps {
  doctorId: string;
  doctorName?: string;
  isDoctorView?: boolean;
  onSaved?: () => void;
  onClose?: () => void;
}

export const DoctorSlotManager: React.FC<DoctorSlotManagerProps> = ({
  doctorId,
  doctorName,
  isDoctorView = false,
  onSaved,
  onClose,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [detectedConflicts, setDetectedConflicts] = useState<any[] | null>(null);

  // Scheduling mode: 'weekly' (Day of Week) vs 'date_month' (Specific Date & Month)
  const [scheduleMode, setScheduleMode] = useState<'weekly' | 'date_month'>('weekly');

  // Date-Month Overrides state
  const [dateOverrides, setDateOverrides] = useState<Array<{
    id: string;
    date: string;
    type: 'custom' | 'blocked';
    start_time?: string;
    end_time?: string;
    slot_duration_minutes?: number;
    reason?: string;
  }>>([]);
  const [overrideDateInput, setOverrideDateInput] = useState<string>('');
  const [overrideTypeInput, setOverrideTypeInput] = useState<'custom' | 'blocked'>('blocked');
  const [overrideStartInput, setOverrideStartInput] = useState<string>('09:00');
  const [overrideEndInput, setOverrideEndInput] = useState<string>('13:00');
  const [overrideDurationInput] = useState<number>(30);
  const [overrideReasonInput, setOverrideReasonInput] = useState<string>('');

  // Selected Day tab (0=Mon...6=Sun, or -1 for All Days)
  const [selectedDayTab, setSelectedDayTab] = useState<number>(0);

  // Weekly state
  const [schedule, setSchedule] = useState<DaySchedule[]>(() =>
    WEEKDAYS.map((w) => ({
      weekday: w.weekday,
      name: w.name,
      short: w.short,
      is_active: w.weekday < 6, // Mon-Sat active by default
      shifts: [
        {
          id: `${w.weekday}-default`,
          start_time: '13:00',
          end_time: '15:00',
          slot_duration_minutes: 30,
        },
      ],
    }))
  );

  const showToast = (text: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Fetch slots and availability metadata from API
  const fetchSlots = async () => {
    if (!doctorId) return;
    setLoading(true);
    setError(null);
    try {
      const [res, docRes] = await Promise.all([
        api.get(`/doctors/${doctorId}/slots`).catch(() => null),
        api.get(`/doctors/${doctorId}`).catch(() => null),
      ]);

      if (docRes?.data?.data?.availability_metadata) {
        try {
          const parsed = JSON.parse(docRes.data.data.availability_metadata);
          if (Array.isArray(parsed.date_overrides)) {
            setDateOverrides(parsed.date_overrides);
          }
        } catch (e) {
          console.error('Error parsing availability metadata:', e);
        }
      }

      if (res?.data && res.data.success) {
        const rawSlots: any[] = res.data.data || [];
        if (rawSlots.length > 0) {
          const grouped: Record<number, any[]> = {};
          rawSlots.forEach((s) => {
            if (!grouped[s.weekday]) grouped[s.weekday] = [];
            grouped[s.weekday].push(s);
          });

          setSchedule((prev) =>
            prev.map((d) => {
              const daySlots = grouped[d.weekday];
              if (daySlots && daySlots.length > 0) {
                const hasActive = daySlots.some((s) => s.is_active);
                return {
                  ...d,
                  is_active: hasActive,
                  shifts: daySlots.map((s, idx) => ({
                    id: s.id || `${d.weekday}-${idx}`,
                    start_time: s.start_time || '13:00',
                    end_time: s.end_time || '15:00',
                    slot_duration_minutes: s.slot_duration_minutes || 30,
                  })),
                };
              }
              return d;
            })
          );
        }
      }
    } catch (err: any) {
      console.error('Error fetching slots:', err);
      setError(err.response?.data?.message || 'Failed to load existing schedule.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDateOverride = () => {
    if (!overrideDateInput) {
      showToast('Please select a specific date.', 'error');
      return;
    }
    const newOv = {
      id: `${overrideDateInput}-${Date.now()}`,
      date: overrideDateInput,
      type: overrideTypeInput,
      start_time: overrideTypeInput === 'custom' ? overrideStartInput : undefined,
      end_time: overrideTypeInput === 'custom' ? overrideEndInput : undefined,
      slot_duration_minutes: overrideTypeInput === 'custom' ? overrideDurationInput : undefined,
      reason: overrideTypeInput === 'blocked' ? (overrideReasonInput || 'Unavailable') : (overrideReasonInput || 'Custom Schedule'),
    };
    setDateOverrides((prev) => [...prev.filter((o) => o.date !== overrideDateInput), newOv]);
    setOverrideDateInput('');
    setOverrideReasonInput('');
    showToast(`Date override for ${overrideDateInput} added!`, 'success');
  };

  const handleRemoveDateOverride = (id: string) => {
    setDateOverrides((prev) => prev.filter((o) => o.id !== id));
    showToast('Date override removed.', 'success');
  };


  useEffect(() => {
    fetchSlots();
  }, [doctorId]);

  // Compute validation errors across the full schedule
  const allValidationErrors = useMemo(() => {
    const errorMap: Record<number, { shiftIndex: number; message: string }[]> = {};
    let totalErrors = 0;
    schedule.forEach((d) => {
      if (d.is_active) {
        const dayErrs = getDayValidationErrors(d);
        if (dayErrs.length > 0) {
          errorMap[d.weekday] = dayErrs;
          totalErrors += dayErrs.length;
        }
      }
    });
    return { errorMap, totalErrors, hasErrors: totalErrors > 0 };
  }, [schedule]);

  // Toggle day active/inactive
  const handleToggleDay = (weekday: number) => {
    setSchedule((prev) =>
      prev.map((d) => {
        if (d.weekday !== weekday) return d;
        const nextActive = !d.is_active;
        return {
          ...d,
          is_active: nextActive,
          shifts:
            d.shifts.length === 0
              ? [
                  {
                    id: `${d.weekday}-${Date.now()}`,
                    start_time: '13:00',
                    end_time: '15:00',
                    slot_duration_minutes: 30,
                  },
                ]
              : d.shifts,
        };
      })
    );
  };

  // Update a specific shift
  const handleUpdateShift = (
    weekday: number,
    shiftIndex: number,
    field: keyof ShiftConfig,
    value: any
  ) => {
    setSchedule((prev) =>
      prev.map((d) => {
        if (d.weekday !== weekday) return d;
        const updatedShifts = d.shifts.map((shift, idx) => {
          if (idx !== shiftIndex) return shift;
          return { ...shift, [field]: value };
        });
        return { ...d, shifts: updatedShifts };
      })
    );
  };

  // Add another shift interval to a day (e.g. morning + evening)
  const handleAddShift = (weekday: number) => {
    setSchedule((prev) =>
      prev.map((d) => {
        if (d.weekday !== weekday) return d;
        const lastShift = d.shifts[d.shifts.length - 1];
        let defaultStart = '16:00';
        let defaultEnd = '19:00';
        if (lastShift && lastShift.end_time) {
          const [eH] = lastShift.end_time.split(':').map(Number);
          const nextH = Math.min(23, eH + 1);
          const endH = Math.min(23, nextH + 3);
          defaultStart = `${String(nextH).padStart(2, '0')}:00`;
          defaultEnd = `${String(endH).padStart(2, '0')}:00`;
        }

        const newShift: ShiftConfig = {
          id: `${d.weekday}-${Date.now()}`,
          start_time: defaultStart,
          end_time: defaultEnd,
          slot_duration_minutes: lastShift?.slot_duration_minutes || 30,
        };
        return { ...d, shifts: [...d.shifts, newShift] };
      })
    );
  };

  // Remove a shift
  const handleRemoveShift = (weekday: number, shiftIndex: number) => {
    setSchedule((prev) =>
      prev.map((d) => {
        if (d.weekday !== weekday) return d;
        if (d.shifts.length <= 1) {
          return { ...d, is_active: false };
        }
        return { ...d, shifts: d.shifts.filter((_, idx) => idx !== shiftIndex) };
      })
    );
  };

  // Quick Preset applied to a shift
  const handleApplyPreset = (weekday: number, shiftIndex: number, start: string, end: string) => {
    setSchedule((prev) =>
      prev.map((d) => {
        if (d.weekday !== weekday) return d;
        const updatedShifts = d.shifts.map((s, idx) => {
          if (idx !== shiftIndex) return s;
          return { ...s, start_time: start, end_time: end };
        });
        return { ...d, shifts: updatedShifts };
      })
    );
  };

  // Copy current day's timings to other days
  const handleCopyDayTimings = (sourceWeekday: number, target: 'working' | 'all') => {
    const sourceDay = schedule.find((d) => d.weekday === sourceWeekday);
    if (!sourceDay || sourceDay.shifts.length === 0) return;

    setSchedule((prev) =>
      prev.map((d) => {
        if (d.weekday === sourceWeekday) return d;
        if (target === 'working' && d.weekday === 6) return d;

        const clonedShifts: ShiftConfig[] = sourceDay.shifts.map((s, idx) => ({
          id: `${d.weekday}-${idx}-${Date.now()}`,
          start_time: s.start_time,
          end_time: s.end_time,
          slot_duration_minutes: s.slot_duration_minutes,
        }));

        return {
          ...d,
          is_active: sourceDay.is_active,
          shifts: clonedShifts,
        };
      })
    );

    showToast(
      target === 'working'
        ? `Applied ${sourceDay.name}'s schedule to Mon–Sat!`
        : `Applied ${sourceDay.name}'s schedule to all 7 days!`
    );
  };

  // Bulk Apply slot duration across all active shifts
  const handleApplyGlobalDuration = (durationMinutes: number) => {
    setSchedule((prev) =>
      prev.map((d) => ({
        ...d,
        shifts: d.shifts.map((s) => ({
          ...s,
          slot_duration_minutes: durationMinutes,
        })),
      }))
    );
    showToast(`Updated all shifts to ${durationMinutes} min slots!`, 'success');
  };

  // Reset to Clinic Standard (09:00 - 17:00, 30 min, Mon-Sat active)
  const handleResetToStandard = () => {
    if (!window.confirm('Reset this doctor\'s entire schedule to clinic standard hours (Mon–Sat 09:00–17:00, 30 min slots)?')) {
      return;
    }
    setSchedule(
      WEEKDAYS.map((w) => ({
        weekday: w.weekday,
        name: w.name,
        short: w.short,
        is_active: w.weekday < 6,
        shifts: [
          {
            id: `${w.weekday}-${Date.now()}`,
            start_time: '09:00',
            end_time: '17:00',
            slot_duration_minutes: 30,
          },
        ],
      }))
    );
    showToast('Reset schedule to clinic standard hours!', 'info' as any);
  };

  // Save Schedule to API
  const handleSave = async () => {
    setError(null);

    // Block save if any validation errors exist
    if (allValidationErrors.hasErrors) {
      const firstWeekday = Object.keys(allValidationErrors.errorMap)[0];
      const firstErr = allValidationErrors.errorMap[Number(firstWeekday)][0];
      const dayName = WEEKDAYS[Number(firstWeekday)].name;
      setError(`${dayName}: ${firstErr.message}`);
      return;
    }

    setSaving(true);
    try {
      const payload: any[] = [];
      schedule.forEach((d) => {
        if (d.is_active && d.shifts.length > 0) {
          d.shifts.forEach((s) => {
            payload.push({
              weekday: d.weekday,
              start_time: s.start_time,
              end_time: s.end_time,
              slot_duration_minutes: Number(s.slot_duration_minutes),
              is_active: true,
            });
          });
        } else {
          const fallback = d.shifts[0] || {
            start_time: '13:00',
            end_time: '15:00',
            slot_duration_minutes: 30,
          };
          payload.push({
            weekday: d.weekday,
            start_time: fallback.start_time,
            end_time: fallback.end_time,
            slot_duration_minutes: Number(fallback.slot_duration_minutes),
            is_active: false,
          });
        }
      });

      const [res] = await Promise.all([
        api.post(`/doctors/${doctorId}/slots`, payload),
        api.put(`/doctors/${doctorId}`, {
          availability_metadata: JSON.stringify({ date_overrides: dateOverrides })
        }).catch(() => null)
      ]);

      if (res && res.data && res.data.success) {
        const conflicts = res.data.meta?.conflicts || [];
        if (conflicts.length > 0) {
          setDetectedConflicts(conflicts);
          showToast(
            `Saved! Warning: ${conflicts.length} upcoming appointment(s) may need rescheduling.`,
            'warning'
          );
        } else {
          showToast('Schedule & Date Overrides saved successfully!', 'success');
        }
        if (onSaved) onSaved();
      } else {
        setError(res?.data?.message || 'Failed to save slots.');
      }

    } catch (err: any) {
      console.error('Error saving doctor slots:', err);
      const detail = err.response?.data?.message || err.response?.data?.detail;
      setError(
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
          ? detail.map((d: any) => d.msg || d).join(', ')
          : 'Error occurred while saving schedule. Please review inputs.'
      );
    } finally {
      setSaving(false);
    }
  };

  // Metrics summary
  const weeklySlotSummary = useMemo(() => {
    let totalSlots = 0;
    let activeDays = 0;
    schedule.forEach((d) => {
      if (d.is_active) {
        activeDays++;
        d.shifts.forEach((s) => {
          const slots = calculateSlots(s.start_time, s.end_time, s.slot_duration_minutes);
          totalSlots += slots.length;
        });
      }
    });
    return { totalSlots, activeDays };
  }, [schedule]);

  return (
    <div className="doctor-slot-manager-card" style={{ backgroundColor: 'var(--surface, #ffffff)', color: 'var(--ink, #102a43)', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow-card)' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            backgroundColor:
              toastMessage.type === 'success'
                ? '#0f766e'
                : toastMessage.type === 'warning'
                ? '#b45309'
                : '#b91c1c',
            color: '#ffffff',
            padding: '14px 22px',
            borderRadius: '12px',
            fontSize: '0.88rem',
            fontWeight: 600,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 12px 28px -5px rgba(0, 0, 0, 0.25)',
          }}
        >
          {toastMessage.type === 'success' ? (
            <Check size={18} />
          ) : toastMessage.type === 'warning' ? (
            <AlertTriangle size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          {toastMessage.text}
        </div>
      )}

      {/* Conflicts Modal */}
      {detectedConflicts && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999999,
            padding: '20px',
          }}
          onClick={() => setDetectedConflicts(null)}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              maxWidth: '560px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: '#fef3c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#b45309',
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#1e293b' }}>
                  Schedule Updated — {detectedConflicts.length} Appointment Conflict{detectedConflicts.length > 1 ? 's' : ''}
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
                  The new slots are saved, but the following upcoming appointments fall outside the new timings:
                </p>
              </div>
            </div>

            <div
              style={{
                maxHeight: '220px',
                overflowY: 'auto',
                border: '1px solid #fed7aa',
                borderRadius: '10px',
                backgroundColor: '#fffbeb',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginBottom: '20px',
              }}
            >
              {detectedConflicts.map((c: any) => (
                <div
                  key={c.id}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #fed7aa',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.85rem',
                  }}
                >
                  <span style={{ fontWeight: 600, color: '#1e293b' }}>{c.patient_name}</span>
                  <span style={{ color: '#b45309', fontWeight: 600, fontSize: '0.82rem' }}>
                    {c.date} at {c.time}
                  </span>
                </div>
              ))}
            </div>

            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 20px 0', lineHeight: 1.4 }}>
              <strong>Action Recommended:</strong> Receptionist or clinic manager should contact these patients to reschedule their consultation into one of the newly opened slots.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setDetectedConflicts(null)}
                style={{
                  backgroundColor: '#0b7894',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Acknowledge & Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0b7894 0%, #16b9d4 100%)',
          color: '#ffffff',
          padding: '24px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={22} color="#ffffff" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#ffffff' }}>
                {doctorName ? `${doctorName} — Time Slots & Schedule` : 'Time Slots & Schedule Manager'}
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: '#e0f7fa', opacity: 0.9 }}>
                {isDoctorView
                  ? 'Configure your daily time intervals (e.g. 1 PM to 3 PM) and slot durations (15 min, 30 min, etc.).'
                  : 'Configure doctor time interval windows (e.g. 1 PM to 3 PM) and slot durations (15 min, 30 min, etc.).'}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Quick Metrics Badge */}
          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.18)',
              padding: '8px 16px',
              borderRadius: '10px',
              display: 'flex',
              gap: '16px',
              alignItems: 'center',
              fontSize: '0.82rem',
              backdropFilter: 'blur(6px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            <div>
              <span style={{ opacity: 0.85 }}>Active Days: </span>
              <strong>{weeklySlotSummary.activeDays}/7</strong>
            </div>
            <div style={{ width: '1px', height: '18px', backgroundColor: 'rgba(255, 255, 255, 0.3)' }} />
            <div>
              <span style={{ opacity: 0.85 }}>Weekly Slots: </span>
              <strong>{weeklySlotSummary.totalSlots} bookable</strong>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                color: '#ffffff',
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Toolbar / Global Batch Actions */}
      <div
        style={{
          backgroundColor: '#f8fafc',
          padding: '12px 28px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Sliders size={14} /> Global Duration Preset:
          </span>
          {[15, 20, 30, 45].map((dur) => (
            <button
              key={dur}
              type="button"
              onClick={() => handleApplyGlobalDuration(dur)}
              style={{
                padding: '4px 10px',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#334155',
                cursor: 'pointer',
              }}
            >
              Set All to {dur}m
            </button>
          ))}
        </div>

        <div>
          <button
            type="button"
            onClick={handleResetToStandard}
            style={{
              padding: '4px 10px',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff',
              color: '#64748b',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <RotateCcw size={12} /> Reset to Clinic Standard
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div style={{ padding: '24px 28px' }}>
        {error && (
          <div
            style={{
              padding: '12px 18px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              borderRadius: '10px',
              marginBottom: '20px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <AlertCircle size={20} />
            <span style={{ fontWeight: 500 }}>{error}</span>
          </div>
        )}

        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw className="spin" size={24} style={{ marginBottom: '12px', color: '#0b7894' }} />
            <p style={{ fontWeight: 500 }}>Loading schedule and availability...</p>
          </div>
        ) : (
          <div>
            {/* Primary Schedule Mode Switcher */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', backgroundColor: '#f1f5f9', padding: '5px', borderRadius: '12px', width: 'fit-content' }}>
              <button
                type="button"
                onClick={() => setScheduleMode('weekly')}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: scheduleMode === 'weekly' ? '#0b7894' : 'transparent',
                  color: scheduleMode === 'weekly' ? '#ffffff' : '#475569',
                  fontWeight: scheduleMode === 'weekly' ? 700 : 500,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                }}
              >
                <Clock size={15} /> Weekly Days Schedule
              </button>
              <button
                type="button"
                onClick={() => setScheduleMode('date_month')}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: scheduleMode === 'date_month' ? '#0b7894' : 'transparent',
                  color: scheduleMode === 'date_month' ? '#ffffff' : '#475569',
                  fontWeight: scheduleMode === 'date_month' ? 700 : 500,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s',
                }}
              >
                <Calendar size={15} /> Specific Date & Month Overrides ({dateOverrides.length})
              </button>
            </div>

            {/* MODE 2: SPECIFIC DATE & MONTH OVERRIDES PANEL */}
            {scheduleMode === 'date_month' && (
              <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem', color: '#0f172a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={18} color="#0b7894" /> Specific Date & Month Availability & Leave Overrides
                </h4>
                <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: '#64748b' }}>
                  Set specific dates/months for special shift timings or mark full-day leave/vacation.
                </p>

                {/* Date Picker Form */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Select Date & Month</label>
                    <input
                      type="date"
                      value={overrideDateInput}
                      onChange={(e) => setOverrideDateInput(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Override Type</label>
                    <select
                      value={overrideTypeInput}
                      onChange={(e: any) => setOverrideTypeInput(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    >
                      <option value="blocked">🔴 Blocked / Full Day Leave</option>
                      <option value="custom">🟢 Custom Working Hours</option>
                    </select>
                  </div>

                  {overrideTypeInput === 'custom' && (
                    <>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Start Time</label>
                        <input
                          type="time"
                          value={overrideStartInput}
                          onChange={(e) => setOverrideStartInput(e.target.value)}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>End Time</label>
                        <input
                          type="time"
                          value={overrideEndInput}
                          onChange={(e) => setOverrideEndInput(e.target.value)}
                          style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Reason / Notes</label>
                    <input
                      type="text"
                      placeholder={overrideTypeInput === 'blocked' ? 'e.g. Conference, Medical Leave' : 'e.g. Special Evening Shift'}
                      value={overrideReasonInput}
                      onChange={(e) => setOverrideReasonInput(e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <button
                      type="button"
                      onClick={handleAddDateOverride}
                      style={{ width: '100%', padding: '9px 14px', backgroundColor: '#0b7894', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <Plus size={16} /> Add Date Override
                    </button>
                  </div>
                </div>

                {/* Date Overrides List */}
                {dateOverrides.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '0.85rem', border: '1px dashed #cbd5e1', borderRadius: '8px' }}>
                    No date-month overrides added yet. Pick a date above to set custom working hours or full-day leave.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
                    {dateOverrides.map((ov) => {
                      const dObj = new Date(ov.date + 'T00:00:00');
                      const formattedDateStr = isNaN(dObj.getTime()) ? ov.date : dObj.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                      return (
                        <div key={ov.id} style={{ padding: '12px 14px', borderRadius: '10px', border: ov.type === 'blocked' ? '1px solid #fecdd3' : '1px solid #bbf7d0', backgroundColor: ov.type === 'blocked' ? '#fff1f2' : '#f0fdf4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b' }}>{formattedDateStr}</div>
                            <div style={{ fontSize: '0.78rem', color: ov.type === 'blocked' ? '#e11d48' : '#16a34a', fontWeight: 600, marginTop: '2px' }}>
                              {ov.type === 'blocked' ? '🔴 Full Day Leave' : `🟢 ${ov.start_time} - ${ov.end_time}`}
                            </div>
                            {ov.reason && <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{ov.reason}</div>}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveDateOverride(ov.id)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}
                            title="Remove Override"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* MODE 1: WEEKLY DAY SELECTOR TABS */}
            {scheduleMode === 'weekly' && (
              <>
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    borderBottom: '1px solid #e2e8f0',
                    paddingBottom: '16px',
                    marginBottom: '24px',
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginRight: '4px' }}>
                    Select Day:
                  </span>

              {WEEKDAYS.map((w) => {
                const dayObj = schedule.find((d) => d.weekday === w.weekday);
                const isActive = dayObj?.is_active ?? false;
                const isSelected = selectedDayTab === w.weekday;
                const hasDayError = Boolean(allValidationErrors.errorMap[w.weekday]);

                return (
                  <button
                    key={w.weekday}
                    onClick={() => setSelectedDayTab(w.weekday)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '20px',
                      border: hasDayError
                        ? '2px solid #ef4444'
                        : isSelected
                        ? '2px solid #0b7894'
                        : '1px solid #cbd5e1',
                      backgroundColor: isSelected ? '#e0f2fe' : isActive ? '#ffffff' : '#f1f5f9',
                      color: hasDayError ? '#b91c1c' : isSelected ? '#0b7894' : isActive ? '#1e293b' : '#94a3b8',
                      fontWeight: isSelected ? 700 : 500,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: hasDayError ? '#ef4444' : isActive ? '#10b981' : '#cbd5e1',
                      }}
                    />
                    {w.short}
                    {hasDayError && <AlertCircle size={12} color="#ef4444" />}
                  </button>
                );
              })}

              <button
                onClick={() => setSelectedDayTab(-1)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '20px',
                  border: selectedDayTab === -1 ? '2px solid #0b7894' : '1px solid #cbd5e1',
                  backgroundColor: selectedDayTab === -1 ? '#0b7894' : '#ffffff',
                  color: selectedDayTab === -1 ? '#ffffff' : '#475569',
                  fontWeight: selectedDayTab === -1 ? 700 : 500,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginLeft: 'auto',
                }}
              >
                <Layers size={14} /> View All 7 Days
              </button>
            </div>

            {/* Content for Selected Day(s) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {schedule
                .filter((d) => selectedDayTab === -1 || d.weekday === selectedDayTab)
                .map((day) => {
                  const dayErrors = allValidationErrors.errorMap[day.weekday] || [];

                  return (
                    <div
                      key={day.weekday}
                      style={{
                        border: dayErrors.length > 0 ? '1.5px solid #fca5a5' : '1px solid #e2e8f0',
                        borderRadius: '14px',
                        padding: '20px',
                        backgroundColor: day.is_active ? '#ffffff' : '#f8fafc',
                        boxShadow: day.is_active
                          ? '0 4px 6px -1px rgba(0, 0, 0, 0.03)'
                          : 'none',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {/* Day Header Row */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '12px',
                          marginBottom: day.is_active ? '16px' : 0,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div
                            style={{
                              width: '42px',
                              height: '42px',
                              borderRadius: '10px',
                              backgroundColor: day.is_active ? '#dcfce7' : '#e2e8f0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              color: day.is_active ? '#15803d' : '#64748b',
                              fontSize: '0.9rem',
                            }}
                          >
                            {day.short}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1e293b' }}>
                                {day.name}
                              </h3>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: day.is_active ? '#dcfce7' : '#fee2e2',
                                  color: day.is_active ? '#15803d' : '#991b1b',
                                }}
                              >
                                {day.is_active ? 'Open for Bookings' : 'Day Off / Closed'}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                              {day.is_active
                                ? `${day.shifts.length} shift interval${day.shifts.length > 1 ? 's' : ''} configured`
                                : 'No appointments can be booked on this day'}
                            </span>
                          </div>
                        </div>

                        {/* Actions: Toggle Active + Copy */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {day.is_active && (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button
                                onClick={() => handleCopyDayTimings(day.weekday, 'working')}
                                title="Copy this day's timing to Mon-Sat"
                                style={{
                                  background: '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  color: '#334155',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Copy size={13} /> Copy to Mon–Sat
                              </button>
                            </div>
                          )}

                          <label
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '8px',
                              cursor: 'pointer',
                              userSelect: 'none',
                              fontSize: '0.82rem',
                              fontWeight: 600,
                              color: day.is_active ? '#0b7894' : '#64748b',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={day.is_active}
                              onChange={() => handleToggleDay(day.weekday)}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                            {day.is_active ? 'Active' : 'Off'}
                          </label>
                        </div>
                      </div>

                      {/* Shifts List for Active Day */}
                      {day.is_active && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
                          {day.shifts.map((shift, shiftIdx) => {
                            const calculatedSlots = calculateSlots(
                              shift.start_time,
                              shift.end_time,
                              shift.slot_duration_minutes
                            );
                            const shiftError = dayErrors.find((e) => e.shiftIndex === shiftIdx);

                            return (
                              <div
                                key={shift.id || shiftIdx}
                                style={{
                                  backgroundColor: shiftError ? '#fff1f2' : '#f8fafc',
                                  border: shiftError ? '1px solid #fecaca' : '1px solid #e2e8f0',
                                  borderRadius: '10px',
                                  padding: '16px',
                                  transition: 'all 0.2s',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: '12px',
                                    flexWrap: 'wrap',
                                    gap: '8px',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0b7894' }}>
                                      Shift Interval #{shiftIdx + 1}
                                    </span>
                                    {shiftError && (
                                      <span
                                        style={{
                                          fontSize: '0.74rem',
                                          fontWeight: 600,
                                          color: '#b91c1c',
                                          backgroundColor: '#fee2e2',
                                          padding: '2px 8px',
                                          borderRadius: '4px',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          gap: '4px',
                                        }}
                                      >
                                        <AlertCircle size={12} /> {shiftError.message}
                                      </span>
                                    )}
                                  </div>

                                  {/* Quick Presets */}
                                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                                      Presets:
                                    </span>
                                    {PRESET_INTERVALS.map((p, pIdx) => (
                                      <button
                                        key={pIdx}
                                        type="button"
                                        onClick={() => handleApplyPreset(day.weekday, shiftIdx, p.start, p.end)}
                                        style={{
                                          padding: '3px 8px',
                                          fontSize: '0.72rem',
                                          borderRadius: '4px',
                                          border:
                                            shift.start_time === p.start && shift.end_time === p.end
                                              ? '1px solid #0b7894'
                                              : '1px solid #cbd5e1',
                                          backgroundColor:
                                            shift.start_time === p.start && shift.end_time === p.end
                                              ? '#e0f2fe'
                                              : '#ffffff',
                                          color:
                                            shift.start_time === p.start && shift.end_time === p.end
                                              ? '#0b7894'
                                              : '#475569',
                                          cursor: 'pointer',
                                          fontWeight: 500,
                                        }}
                                      >
                                        {p.label}
                                      </button>
                                    ))}

                                    {day.shifts.length > 1 && (
                                      <button
                                        onClick={() => handleRemoveShift(day.weekday, shiftIdx)}
                                        title="Remove this shift interval"
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          color: '#ef4444',
                                          cursor: 'pointer',
                                          padding: '4px',
                                          marginLeft: '4px',
                                        }}
                                      >
                                        <Trash2 size={15} />
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Controls: Option 1 (Interval) & Option 2 (Slot Duration) */}
                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                    gap: '16px',
                                    alignItems: 'end',
                                  }}
                                >
                                  {/* Option 1: Start Time */}
                                  <div>
                                    <label
                                      style={{
                                        display: 'block',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        color: '#334155',
                                        marginBottom: '6px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                      }}
                                    >
                                      ① Shift Start Time
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                      <input
                                        type="time"
                                        value={shift.start_time}
                                        onChange={(e) =>
                                          handleUpdateShift(day.weekday, shiftIdx, 'start_time', e.target.value)
                                        }
                                        style={{
                                          width: '100%',
                                          padding: '9px 12px',
                                          borderRadius: '8px',
                                          border: '1px solid #cbd5e1',
                                          fontSize: '0.9rem',
                                          fontWeight: 600,
                                          color: '#1e293b',
                                          backgroundColor: '#ffffff',
                                        }}
                                      />
                                    </div>
                                    <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
                                      {formatTo12Hour(shift.start_time)}
                                    </span>
                                  </div>

                                  {/* Option 1: End Time */}
                                  <div>
                                    <label
                                      style={{
                                        display: 'block',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        color: '#334155',
                                        marginBottom: '6px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                      }}
                                    >
                                      ① Shift End Time
                                    </label>
                                    <div style={{ position: 'relative' }}>
                                      <input
                                        type="time"
                                        value={shift.end_time}
                                        onChange={(e) =>
                                          handleUpdateShift(day.weekday, shiftIdx, 'end_time', e.target.value)
                                        }
                                        style={{
                                          width: '100%',
                                          padding: '9px 12px',
                                          borderRadius: '8px',
                                          border: shiftError ? '1px solid #ef4444' : '1px solid #cbd5e1',
                                          fontSize: '0.9rem',
                                          fontWeight: 600,
                                          color: '#1e293b',
                                          backgroundColor: '#ffffff',
                                        }}
                                      />
                                    </div>
                                    <span
                                      style={{
                                        fontSize: '0.72rem',
                                        color: '#64748b',
                                        marginTop: '2px',
                                        display: 'block',
                                      }}
                                    >
                                      {formatTo12Hour(shift.end_time)}
                                    </span>
                                  </div>

                                  {/* Option 2: Slot Duration Interval */}
                                  <div>
                                    <label
                                      style={{
                                        display: 'block',
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        color: '#334155',
                                        marginBottom: '6px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                      }}
                                    >
                                      ② Slot Duration (Interval)
                                    </label>
                                    <select
                                      value={shift.slot_duration_minutes}
                                      onChange={(e) =>
                                        handleUpdateShift(
                                          day.weekday,
                                          shiftIdx,
                                          'slot_duration_minutes',
                                          Number(e.target.value)
                                        )
                                      }
                                      style={{
                                        width: '100%',
                                        padding: '9px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '0.85rem',
                                        fontWeight: 600,
                                        color: '#0b7894',
                                        backgroundColor: '#ffffff',
                                      }}
                                    >
                                      {DURATION_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                          {opt.label}
                                        </option>
                                      ))}
                                    </select>
                                    <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px', display: 'block' }}>
                                      Interval per appointment
                                    </span>
                                  </div>
                                </div>

                                {/* Live Slot Generation Preview */}
                                <div
                                  style={{
                                    marginTop: '16px',
                                    paddingTop: '14px',
                                    borderTop: '1px dashed #cbd5e1',
                                  }}
                                >
                                  <div
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      marginBottom: '8px',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                      <Sparkles size={14} color="#0b7894" />
                                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155' }}>
                                        Live Generated Slots Preview:
                                      </span>
                                    </div>
                                    <span
                                      style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        color: calculatedSlots.length > 0 ? '#15803d' : '#ef4444',
                                        backgroundColor: calculatedSlots.length > 0 ? '#dcfce7' : '#fee2e2',
                                        padding: '2px 8px',
                                        borderRadius: '4px',
                                      }}
                                    >
                                      {calculatedSlots.length} Bookable Slot{calculatedSlots.length !== 1 ? 's' : ''}
                                    </span>
                                  </div>

                                  {calculatedSlots.length === 0 ? (
                                    <div
                                      style={{
                                        padding: '10px',
                                        backgroundColor: '#fff1f2',
                                        color: '#be123c',
                                        fontSize: '0.78rem',
                                        borderRadius: '6px',
                                      }}
                                    >
                                      No slots generated. Please ensure End Time is after Start Time by at least{' '}
                                      {shift.slot_duration_minutes} minutes.
                                    </div>
                                  ) : (
                                    <div
                                      style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '6px',
                                        maxHeight: '130px',
                                        overflowY: 'auto',
                                        padding: '4px 0',
                                      }}
                                    >
                                      {calculatedSlots.map((slot, sIdx) => (
                                        <div
                                          key={sIdx}
                                          style={{
                                            padding: '4px 8px',
                                            borderRadius: '6px',
                                            fontSize: '0.72rem',
                                            fontWeight: 600,
                                            backgroundColor: '#ffffff',
                                            border: '1px solid #cbd5e1',
                                            color: '#1e293b',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                                          }}
                                        >
                                          <Clock size={11} color="#0b7894" />
                                          <span>
                                            {formatTo12Hour(slot.start)} – {formatTo12Hour(slot.end)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}

                          {/* Button to add another split shift */}
                          <div>
                            <button
                              type="button"
                              onClick={() => handleAddShift(day.weekday)}
                              style={{
                                background: '#f8fafc',
                                border: '1px dashed #0b7894',
                                color: '#0b7894',
                                padding: '8px 14px',
                                borderRadius: '8px',
                                fontSize: '0.78rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                              }}
                            >
                              <Plus size={14} /> Add Another Shift Interval for {day.name} (Split Shift)
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
            </>
            )}

            {/* Bottom Save Bar */}
            <div
              style={{
                marginTop: '28px',
                paddingTop: '20px',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
              }}
            >
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Total weekly bookable slots: <strong>{weeklySlotSummary.totalSlots}</strong> across{' '}
                <strong>{weeklySlotSummary.activeDays}</strong> active days.
                {allValidationErrors.hasErrors && (
                  <span style={{ color: '#ef4444', fontWeight: 600, marginLeft: '8px' }}>
                    (Please fix highlighted timing errors before saving)
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={saving}
                    style={{
                      padding: '10px 18px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      backgroundColor: '#ffffff',
                      color: '#475569',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || allValidationErrors.hasErrors}
                  style={{
                    padding: '10px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    background: allValidationErrors.hasErrors
                      ? '#94a3b8'
                      : 'linear-gradient(135deg, #0b7894 0%, #16b9d4 100%)',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: saving || allValidationErrors.hasErrors ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: allValidationErrors.hasErrors ? 'none' : '0 4px 10px rgba(11, 120, 148, 0.3)',
                    opacity: saving ? 0.7 : 1,
                  }}
                >
                  {saving ? (
                    <>
                      <RefreshCw className="spin" size={16} /> Saving Schedule...
                    </>
                  ) : (
                    <>
                      <Save size={16} /> Save Schedule & Time Slots
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
