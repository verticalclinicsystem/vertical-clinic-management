import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';

interface CustomDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  id,
  placeholder = 'Select Date',
  className = '',
  style,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (value) {
      const [y, m] = value.split('-').map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date();
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) {
      const [y, m] = value.split('-').map(Number);
      setViewDate(new Date(y, m - 1, 1));
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    const y = viewDate.getFullYear();
    const m = String(viewDate.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
    setIsOpen(false);
  };

  const handleToday = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    onChange(`${y}-${m}-${d}`);
    setViewDate(new Date(y, today.getMonth(), 1));
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setIsOpen(false);
  };

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const daysArray = [];
  for (let i = 0; i < firstDayIndex; i++) {
    daysArray.push(null);
  }
  for (let i = 1; i <= totalDays; i++) {
    daysArray.push(i);
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const currentYear = new Date().getFullYear();
  const yearsList = Array.from({ length: 120 }, (_, i) => currentYear + 10 - i);

  const getDisplayValue = () => {
    if (!value) return placeholder;
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return placeholder;
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const selectedDay = value ? Number(value.split('-')[2]) : null;
  const selectedMonth = value ? Number(value.split('-')[1]) - 1 : null;
  const selectedYear = value ? Number(value.split('-')[0]) : null;

  return (
    <div 
      ref={containerRef} 
      className={`custom-datepicker-container ${className}`} 
      style={{ position: 'relative', display: 'inline-block', width: '100%', ...style }}
    >
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 14px',
          borderRadius: '8px',
          border: '1px solid #cbd5e1',
          background: '#ffffff',
          color: value ? '#0f172a' : '#94a3b8',
          fontSize: '0.9rem',
          fontWeight: 500,
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
          transition: 'all 0.2s',
          outline: 'none',
          justifyContent: 'space-between',
          height: '42px',
          width: '100%',
          opacity: disabled ? 0.65 : 1
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={18} style={{ color: 'var(--primary-teal, #0d9488)', flexShrink: 0 }} />
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {getDisplayValue()}
          </span>
        </div>
        {value && !disabled && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px',
              borderRadius: '50%',
              cursor: 'pointer',
              color: '#94a3b8',
              transition: 'all 0.15s',
              flexShrink: 0
            }}
          >
            <X size={16} />
          </span>
        )}
      </button>

      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 1000,
            width: '300px',
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            padding: '16px',
            userSelect: 'none'
          }}
        >
          {/* Calendar Header with Select Dropdowns */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '4px' }}>
            <button
              type="button"
              onClick={handlePrevMonth}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                cursor: 'pointer',
                color: '#64748b',
                outline: 'none'
              }}
            >
              <ChevronLeft size={16} />
            </button>
            
            <div style={{ display: 'flex', gap: '4px' }}>
              <select
                value={month}
                onChange={(e) => setViewDate(new Date(year, Number(e.target.value), 1))}
                style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '2px 4px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  background: '#ffffff',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {monthNames.map((name, idx) => (
                  <option key={name} value={idx}>{name}</option>
                ))}
              </select>
              
              <select
                value={year}
                onChange={(e) => setViewDate(new Date(Number(e.target.value), month, 1))}
                style={{
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '2px 4px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  color: '#1e293b',
                  background: '#ffffff',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                {yearsList.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                cursor: 'pointer',
                color: '#64748b',
                outline: 'none'
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekdays Header */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '8px' }}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
              <span key={day} style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8' }}>
                {day}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {daysArray.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} />;
              }

              const isSelected = selectedDay === day && selectedMonth === month && selectedYear === year;
              const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '34px',
                    height: '34px',
                    borderRadius: '6px',
                    border: 'none',
                    fontSize: '0.82rem',
                    fontWeight: isSelected || isToday ? 700 : 500,
                    cursor: 'pointer',
                    outline: 'none',
                    background: isSelected 
                      ? 'var(--primary-teal, #0d9488)' 
                      : isToday 
                        ? '#ccfbf1' 
                        : '#ffffff',
                    color: isSelected 
                      ? '#ffffff' 
                      : isToday 
                        ? '#0d9488' 
                        : '#334155',
                    transition: 'all 0.15s'
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Popover Footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '12px',
              paddingTop: '10px',
              borderTop: '1px solid #f1f5f9'
            }}
          >
            <button
              type="button"
              onClick={handleToday}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary-teal, #0d9488)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '4px'
              }}
            >
              Today
            </button>
            <button
              type="button"
              onClick={handleClear}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '4px'
              }}
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
