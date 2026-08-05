import React from 'react';
import { ChevronRight } from 'lucide-react';

interface BookingWizardProps {
  bookingStep: number;
  setBookingStep: (step: number) => void;
  branches: any[];
  selectedBranchId: string;
  handleBranchSelect: (branchId: string) => void;

  consultationType: string;
  setConsultationType: (type: string) => void;

  doctors: any[];
  selectedDoctorId: string;
  handleDoctorSelect: (doctorId: string) => void;
  filterSpecialty: string;
  setFilterSpecialty: (val: string) => void;
  filterExperience: string;
  setFilterExperience: (val: string) => void;
  filterGender: string;
  setFilterGender: (val: string) => void;
  filterLanguage: string;
  setFilterLanguage: (val: string) => void;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  sortOption: string;
  setSortOption: (val: string) => void;
  filteredAndSortedDoctors: any[];
  renderSummarySidebar: () => React.ReactNode;

  bookingDate: string;
  bookingSlot: string;
  setBookingSlot: (slot: string) => void;
  handleDateChange: (date: string) => void;
  calendarViewMonth: number;
  setCalendarViewMonth: (m: number) => void;
  calendarViewYear: number;
  setCalendarViewYear: (y: number) => void;
  handlePrevMonth: () => void;
  handleNextMonth: () => void;
  getDaysArray: (year: number, month: number) => any[];
  MONTH_NAMES: string[];
  formatTimeToAMPM: (time: string) => string;
  availableSlots: any[];

  patientProfile: any;
  treatmentType: string;
  setTreatmentType: (t: string) => void;
  customTreatmentText: string;
  setCustomTreatmentText: (txt: string) => void;
  bookingSymptoms: string;
  setBookingSymptoms: (sym: string) => void;
  attachedReportId: string | null;
  setAttachedReportId: (id: string | null) => void;
  dashboardData: any;
  bookingNotes: string;
  setBookingNotes: (notes: string) => void;

  clearBookingWizardState: () => void;
  setScreen: (screen: any) => void;
  setShowBookingConfirm: (show: boolean) => void;
  isLoading: boolean;
}

export const BookingWizard: React.FC<BookingWizardProps> = ({
  bookingStep,
  setBookingStep,
  branches,
  selectedBranchId,
  handleBranchSelect,

  consultationType,
  setConsultationType,

  doctors,
  selectedDoctorId,
  handleDoctorSelect,
  filterSpecialty,
  setFilterSpecialty,
  setFilterExperience,
  filterGender,
  setFilterGender,
  setFilterLanguage,
  searchQuery,
  setSearchQuery,
  setSortOption,
  filteredAndSortedDoctors,
  renderSummarySidebar,

  bookingDate,
  bookingSlot,
  setBookingSlot,
  handleDateChange,
  calendarViewMonth,
  setCalendarViewMonth,
  calendarViewYear,
  setCalendarViewYear,
  handlePrevMonth,
  handleNextMonth,
  getDaysArray,
  MONTH_NAMES,
  formatTimeToAMPM,
  availableSlots,

  patientProfile,
  treatmentType,
  setTreatmentType,
  customTreatmentText,
  setCustomTreatmentText,
  bookingSymptoms,
  setBookingSymptoms,
  attachedReportId,
  setAttachedReportId,
  dashboardData,
  bookingNotes,
  setBookingNotes,

  clearBookingWizardState,
  setScreen,
  setShowBookingConfirm,
  isLoading,
}) => {
  const safeBranches = Array.isArray(branches) ? branches : [];
  const safeDoctors = Array.isArray(doctors) ? doctors : [];
  const safeFilteredDoctors = Array.isArray(filteredAndSortedDoctors) ? filteredAndSortedDoctors : [];
  const safeAvailableSlots = Array.isArray(availableSlots)
    ? availableSlots
    : (Array.isArray((availableSlots as any)?.data?.items)
      ? (availableSlots as any).data.items
      : (Array.isArray((availableSlots as any)?.data)
        ? (availableSlots as any).data
        : []));

  return (
    <div className="book-page">
      <div className="book-page-header">
        <div>
          <p style={{ color: 'var(--muted)', fontSize: '0.88rem', marginTop: '4px' }}>Follow the steps below to schedule your visit</p>
        </div>
        <button onClick={() => { clearBookingWizardState(); setScreen('dashboard'); }} className="btn-secondary">
          ← Back to Dashboard
        </button>
      </div>

      <div className="book-page-body">
        {/* Top: Horizontal Stepper */}
        <div className="book-steps-panel-horizontal">
          {[
            { num: 1, label: 'Branch', sub: 'Choose clinic' },
            { num: 2, label: 'Mode', sub: 'Consultation type' },
            { num: 3, label: 'Doctor', sub: 'Select clinician' },
            { num: 4, label: 'Date & Time', sub: 'Pick a slot' },
            { num: 5, label: 'Details', sub: 'Confirm & notes' },
          ].map((step, idx) => {
            const isActive = bookingStep === step.num;
            const isDone = bookingStep > step.num;
            return (
              <React.Fragment key={step.num}>
                <div className={`book-step-item-horizontal ${isActive ? 'active' : isDone ? 'done' : ''}`}>
                  <div className="book-step-circle-horizontal">
                    {isDone ? '✓' : step.num}
                  </div>
                  <div className="book-step-text-horizontal">
                    <span className="book-step-title-horizontal">{step.label}</span>
                    <span className="book-step-sub-horizontal">{step.sub}</span>
                  </div>
                </div>
                {idx < 4 && (
                  <div className="book-step-arrow">→</div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Main Content Area */}
        <div className="book-step-content-area" style={{ flex: 1, marginTop: '5px' }}>

          {/* Step 1: Branch */}
          {bookingStep === 1 && (
            <div className="card" style={{ padding: '24px', animation: 'fadeIn 0.3s ease-out' }}>
              <h3 style={{ marginBottom: '6px', fontSize: '1.1rem' }}>Choose Branch Location</h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.84rem', marginBottom: '20px' }}>Select the clinic branch you'd like to visit</p>

              <div className="branch-selection-list">
                {safeBranches.map((b: any) => {
                  const isSelected = selectedBranchId === b.id;
                  return (
                    <div
                      key={b.id}
                      className={`branch-card-horizontal ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleBranchSelect(b.id)}
                    >
                      <div className="branch-image-placeholder">
                        <span>🏥 {b.name.substring(0, 2)}</span>
                      </div>
                      <div className="branch-info-main">
                        <div className="branch-title-row">
                          <span className="location-pin-badge">📍</span>
                          <h4>{b.name} Branch</h4>
                        </div>
                        <p className="branch-address">{b.address}</p>
                        <p className="branch-phone">📞 {b.phone}</p>
                      </div>
                      <div className="branch-info-extra">
                        <p className="branch-working-hours">🕒 Mon - Sat: 9:00 AM - 9:00 PM | Sun: 9:00 AM - 2:00 PM</p>
                        <p className="branch-parking">🅿️ Parking Available</p>
                      </div>
                      <div className="branch-radio-wrapper">
                        <div className={`custom-radio-circle ${isSelected ? 'checked' : ''}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Mode */}
          {bookingStep === 2 && (
            <div className="card" style={{ padding: '20px', animation: 'fadeIn 0.3s ease-out' }}>
              <h3 style={{ marginBottom: '6px', fontSize: '1.1rem' }}>Select Consultation Mode</h3>
              <p style={{ color: 'var(--muted)', fontSize: '0.84rem', marginBottom: '20px' }}>Choose how you would like to connect with your doctor</p>

              <div className="consultation-mode-cards">
                <div
                  className={`mode-card ${consultationType === 'in_person' ? 'selected' : ''}`}
                  onClick={() => setConsultationType('in_person')}
                >
                  <div className="mode-card-icon-placeholder">🏥</div>
                  <h4 className="mode-card-title">In Clinic</h4>
                  <p className="mode-card-desc">Visit the branch in person for a face-to-face checkup</p>
                  <ul className="mode-card-benefits">
                    <li><span className="benefit-check">✓</span> Physical examination</li>
                    <li><span className="benefit-check">✓</span> Direct personal care</li>
                    <li><span className="benefit-check">✓</span> Access to clinic equipment</li>
                  </ul>
                  <span className="mode-card-duration-badge">⏱️ 30 Minutes</span>
                </div>

                <div
                  className={`mode-card ${consultationType === 'teleconsultation' ? 'selected' : ''}`}
                  onClick={() => setConsultationType('teleconsultation')}
                >
                  <div className="mode-card-recommended-badge">Recommended</div>
                  <div className="mode-card-icon-placeholder">💻</div>
                  <h4 className="mode-card-title">Tele Consultation</h4>
                  <p className="mode-card-desc">Join a secure video call from the comfort of your home</p>
                  <ul className="mode-card-benefits">
                    <li><span className="benefit-check tele">✓</span> Safe & convenient</li>
                    <li><span className="benefit-check tele">✓</span> Save travel time & cost</li>
                    <li><span className="benefit-check tele">✓</span> Digital prescription included</li>
                  </ul>
                  <span className="mode-card-duration-badge">⏱️ 20-30 Minutes</span>
                </div>
              </div>

              <div className="mode-info-banner">
                <div className="mode-info-banner-illustration">💡</div>
                <p className="mode-info-banner-text">
                  <strong>Note:</strong> Teleconsultation is ideal for initial assessments, report reviews, and follow-ups. In-person visits are recommended for treatments requiring procedures.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: Doctor Selection */}
          {bookingStep === 3 && (() => {
            const uniqueSpecs = Array.from(new Set(safeDoctors.map(d => d.specialization || d.specialty || 'General Dentist')));
            return (
              <div className="doctor-selection-layout" style={{ animation: 'fadeIn 0.3s ease-out' }}>
                <div className="doctor-filters-card">
                  <div className="doctor-filters-header">
                    <h4>🔍 Filter Clinicians</h4>
                    <button
                      type="button"
                      className="clear-filters-btn"
                      onClick={() => {
                        setFilterSpecialty('');
                        setFilterExperience('');
                        setFilterGender('');
                        setFilterLanguage('');
                        setSearchQuery('');
                        setSortOption('experience_desc');
                      }}
                    >
                      Reset
                    </button>
                  </div>

                  <div className="filter-group">
                    <label className="filter-label">Search Name / Specialty</label>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="e.g. Sneha or Orthodontist"
                      className="filter-select"
                      style={{ background: 'var(--surface-2)' }}
                    />
                  </div>

                  <div className="filter-group">
                    <label className="filter-label">Specialization</label>
                    <select
                      value={filterSpecialty}
                      onChange={(e) => setFilterSpecialty(e.target.value)}
                      className="filter-select"
                    >
                      <option value="">All Specialities</option>
                      {uniqueSpecs.map(spec => (
                        <option key={spec} value={spec}>{spec}</option>
                      ))}
                    </select>
                  </div>

                  <div className="filter-group">
                    <label className="filter-label">Gender</label>
                    <select
                      value={filterGender}
                      onChange={(e) => setFilterGender(e.target.value)}
                      className="filter-select"
                    >
                      <option value="">Any Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    className="reset-filters-btn-block"
                    onClick={() => {
                      setFilterSpecialty('');
                      setFilterExperience('');
                      setFilterGender('');
                      setFilterLanguage('');
                      setSearchQuery('');
                      setSortOption('experience_desc');
                    }}
                  >
                    Reset All Filters
                  </button>
                </div>

                <div className="doctor-list-container" style={{ flex: 1 }}>
                  <div className="doctor-list-header">
                    <div className="doctor-list-header-info">
                      Select Your Clinician &nbsp;•&nbsp; <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{safeFilteredDoctors.length} Doctors Available</span>
                    </div>
                  </div>

                  <div className="doctor-cards-grid" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {safeFilteredDoctors.map((doc: any) => {
                      const isSelected = selectedDoctorId === doc.id;
                      const inferredGender = (doc.user?.full_name?.includes('Sneha') || doc.user?.full_name?.includes('Anjali') || doc.user?.full_name?.includes('Desai')) ? 'Female' : 'Male';

                      return (
                        <div
                          key={doc.id}
                          className={`doctor-card-horizontal ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleDoctorSelect(doc.id)}
                        >
                          <div className="doctor-avatar-circle-placeholder">
                            <span>Dr</span>
                          </div>
                          <div className="doctor-card-middle-info">
                            <div className="doctor-card-name-row">
                              <h4>
                                {doc.user?.full_name?.toLowerCase().startsWith('dr') ? doc.user?.full_name : `Dr. ${doc.user?.full_name}`}
                              </h4>
                              <span className="doctor-verified-badge">✓ Verified</span>
                            </div>
                            <p className="doctor-card-specialization">{doc.specialization || 'General Dentist'}</p>

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                              <span className="doctor-card-mode-pill">👤 {inferredGender}</span>
                            </div>
                            <div className="doctor-card-rating">
                              <span className="doctor-card-rating-star">★</span>
                              <strong>{doc.rating || '4.8'}</strong>&nbsp;({doc.experience_years * 12 + 15} reviews)
                            </div>
                            <p className="doctor-card-meta-details" style={{ marginTop: '8px', lineHeight: '1.4' }}>
                              {doc.bio || 'Dedicated clinician offering comprehensive services and personalized dental/medical treatments.'}
                            </p>
                          </div>
                          <div className="doctor-card-right-info">
                            <span className={`doctor-card-mode-pill ${consultationType === 'teleconsultation' ? 'tele' : ''}`}>
                              {consultationType === 'teleconsultation' ? 'Teleconsult' : 'In-Clinic'}
                            </span>
                            <div className="doctor-card-fee-label" style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '4px' }}>Consultation Fee</div>
                            <div className="doctor-card-fee">₹{doc.consultation_fee}</div>
                            <button
                              type="button"
                              className={`btn-select-doctor ${isSelected ? 'selected' : ''}`}
                              style={{
                                width: '100%',
                                padding: '8px 14px',
                                borderRadius: '8px',
                                border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border)',
                                background: isSelected ? 'var(--primary)' : 'var(--surface-2)',
                                color: isSelected ? '#fff' : 'var(--ink)',
                                fontWeight: '600',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                transition: 'var(--transition-all)',
                                marginTop: '8px'
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDoctorSelect(doc.id);
                              }}
                            >
                              {isSelected ? 'Selected ✓' : 'Select Doctor'}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {safeFilteredDoctors.length === 0 && (
                      <div className="doctor-list-empty-state">
                        <span>👨‍⚕️</span>
                        <h4>No clinicians match your filter criteria</h4>
                        <p>Try resetting filters or searching with a different keyword.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="doctor-sidebar-column">
                  {renderSummarySidebar()}
                </div>
              </div>
            );
          })()}

          {/* Step 4: Date & Time Slot selection */}
          {bookingStep === 4 && (() => {
            const activeDoctor = safeDoctors.find((d: any) => d.id === selectedDoctorId);
            const doctorName = activeDoctor?.user?.full_name?.toLowerCase().startsWith('dr')
              ? activeDoctor.user.full_name
              : `Dr. ${activeDoctor?.user?.full_name || 'Clinician'}`;
            const doctorSpecialty = activeDoctor?.specialization || 'General Dentist';
            const getSlotTime = (s: any): string => {
              if (!s) return '';
              if (typeof s === 'string') return s;
              return s.time || s.start_time || s.slot_time || '';
            };

            const getSlotStatus = (s: any): string => {
              if (!s) return 'available';
              if (typeof s === 'string') return 'available';
              if (s.status) return s.status;
              if (s.is_active === false) return 'booked';
              return 'available';
            };

            const availableSlotsCount = safeAvailableSlots.filter((s: any) => getSlotStatus(s) === 'available').length;

            const formatFriendlyDate = (dateStr: string) => {
              if (!dateStr) return '';
              const parts = dateStr.split('-');
              const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
              return dateObj.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            };

            const morningSlots = safeAvailableSlots.filter((s: any) => {
              const t = getSlotTime(s);
              if (!t || !t.includes(':')) return false;
              const hr = parseInt(t.split(':')[0], 10);
              return hr < 12;
            });

            const afternoonSlots = safeAvailableSlots.filter((s: any) => {
              const t = getSlotTime(s);
              if (!t || !t.includes(':')) return false;
              const hr = parseInt(t.split(':')[0], 10);
              return hr >= 12 && hr < 16;
            });

            const eveningSlots = safeAvailableSlots.filter((s: any) => {
              const t = getSlotTime(s);
              if (!t || !t.includes(':')) return false;
              const hr = parseInt(t.split(':')[0], 10);
              return hr >= 16;
            });

            const renderSlotButton = (slot: any) => {
              const slotTime = getSlotTime(slot);
              const slotStatus = getSlotStatus(slot);
              
              const isBooked = slotStatus === 'booked';
              const isLunch = slotStatus === 'lunch_break';
              const isTeleOnly = slotStatus === 'tele_only';
              const isInClinicOnly = slotStatus === 'in_clinic_only';
              const isExpired = slotStatus === 'expired';
              
              const isDisable = isBooked || isLunch || isTeleOnly || isInClinicOnly || isExpired;
              const isSelected = bookingSlot === slotTime;

              let labelSuffix = '';
              let tooltip = `Book ${formatTimeToAMPM(slotTime)}`;
              
              if (isBooked) {
                labelSuffix = ' 🔒';
                tooltip = 'This slot is already booked';
              } else if (isLunch) {
                labelSuffix = ' 🥪';
                tooltip = 'Lunch Break';
              } else if (isTeleOnly) {
                labelSuffix = ' 📹';
                tooltip = 'Teleconsultation Only';
              } else if (isInClinicOnly) {
                labelSuffix = ' 🏥';
                tooltip = 'In-Clinic Only';
              } else if (isExpired) {
                labelSuffix = ' ⏳';
                tooltip = 'Slot Expired';
              }

              return (
                <button
                  key={slotTime || Math.random()}
                  type="button"
                  className={`slot-item-btn${isSelected ? ' selected' : ''}${isDisable ? ' booked' : ''}`}
                  onClick={() => !isDisable && slotTime && setBookingSlot(slotTime)}
                  disabled={isDisable || !slotTime}
                  title={tooltip}
                >
                  {formatTimeToAMPM(slotTime)}
                  {labelSuffix && <span style={{ fontSize: '0.7rem', marginLeft: '4px' }}>{labelSuffix}</span>}
                </button>
              );
            };

            return (
              <div className="card" style={{ padding: '24px', animation: 'fadeIn 0.3s ease-out' }}>
                <h3 style={{ marginBottom: '6px', fontSize: '1.1rem' }}>Select Date & Time Slot</h3>
                <p style={{ color: 'var(--muted)', fontSize: '0.84rem', marginBottom: '20px' }}>Choose a convenient date and time for your appointment</p>

                <div className="booking-calendar-layout">
                  <div className="calendar-card">
                    <div className="calendar-header">
                      <span className="calendar-month-title">
                        {MONTH_NAMES[calendarViewMonth]} {calendarViewYear}
                      </span>
                      <div className="calendar-nav-buttons">
                        <button
                          type="button"
                          className="calendar-nav-btn"
                          onClick={handlePrevMonth}
                          disabled={
                            calendarViewYear < new Date().getFullYear() ||
                            (calendarViewYear === new Date().getFullYear() && calendarViewMonth <= new Date().getMonth())
                          }
                        >
                          &larr;
                        </button>
                        <button
                          type="button"
                          className="calendar-nav-btn"
                          onClick={handleNextMonth}
                        >
                          &rarr;
                        </button>
                      </div>
                    </div>

                    <div className="calendar-days-of-week">
                      <div>Sun</div>
                      <div>Mon</div>
                      <div>Tue</div>
                      <div>Wed</div>
                      <div>Thu</div>
                      <div>Fri</div>
                      <div>Sat</div>
                    </div>

                    <div className="calendar-days-grid">
                      {getDaysArray(calendarViewYear, calendarViewMonth).map((dItem, idx) => {
                        const isSelected = bookingDate === dItem.dateString;
                        const isDisabled = dItem.isPast;
                        return (
                          <button
                            key={idx}
                            type="button"
                            className={`calendar-day-btn ${dItem.isCurrentMonth ? 'current-month' : 'other-month'}${isSelected ? ' selected' : ''}`}
                            onClick={() => handleDateChange(dItem.dateString)}
                            disabled={isDisabled}
                          >
                            {dItem.day}
                          </button>
                        );
                      })}
                    </div>

                    <div className="calendar-today-btn-wrapper">
                      <button
                        type="button"
                        className="calendar-today-btn"
                        onClick={() => {
                          const todayStr = new Date().toISOString().split('T')[0];
                          handleDateChange(todayStr);
                          setCalendarViewMonth(new Date().getMonth());
                          setCalendarViewYear(new Date().getFullYear());
                        }}
                      >
                        Today
                      </button>
                    </div>
                  </div>

                  <div className="slots-container">
                    <div className="slot-doctor-card">
                      <div className="slot-doctor-profile">
                        <div className="slot-doctor-avatar">Dr</div>
                        <div className="slot-doctor-details">
                          <div className="slot-doctor-name">{doctorName}</div>
                          <div className="slot-doctor-specialty">{doctorSpecialty}</div>
                          <div className="slot-doctor-meta">
                            <span>🕐 30 mins</span>
                            <span>💻 {consultationType === 'teleconsultation' ? 'Tele Consultation' : 'In Clinic'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="slot-availability-pill">
                        <span className="slot-availability-pill-title">{availableSlotsCount} Slots Available</span>
                        <span className="slot-availability-pill-date">{formatFriendlyDate(bookingDate)}</span>
                      </div>
                    </div>

                    <div className="slot-timezone-bar">
                      <span>🕐 All times are shown in Asia/Kolkata (IST)</span>
                    </div>

                    {/* Explanatory Notification Banner for Teleconsultation vs In-Person Slots */}
                    {consultationType === 'teleconsultation' ? (
                      <div className="slot-notice-banner tele">
                        <span className="notice-icon">💻</span>
                        <div className="notice-text">
                          <strong>Teleconsultation Video Hours:</strong> Only 3:00 PM – 5:00 PM slots are available for online video consultation calls.
                        </div>
                      </div>
                    ) : (
                      <div className="slot-notice-banner in-person">
                        <span className="notice-icon">ℹ️</span>
                        <div className="notice-text">
                          <strong>In-Clinic Schedule Note:</strong> 3:00 PM – 5:00 PM slots are reserved for online Teleconsultations and are not available for in-clinic visits.
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {morningSlots.length > 0 && (
                        <div className="slot-category-section">
                          <div className="slot-category-header">
                            <span>🌅</span> Morning
                          </div>
                          <div className="slot-category-grid">
                            {morningSlots.map(renderSlotButton)}
                          </div>
                        </div>
                      )}

                      {afternoonSlots.length > 0 && (
                        <div className="slot-category-section">
                          <div className="slot-category-header">
                            <span>☀️</span> Afternoon
                          </div>
                          <div className="slot-category-grid">
                            {afternoonSlots.map(renderSlotButton)}
                          </div>
                        </div>
                      )}

                      {eveningSlots.length > 0 && (
                        <div className="slot-category-section">
                          <div className="slot-category-header">
                            <span>🌆</span> Evening
                          </div>
                          <div className="slot-category-grid">
                            {eveningSlots.map(renderSlotButton)}
                          </div>
                        </div>
                      )}

                      {safeAvailableSlots.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--muted)', background: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                          No slots available for the selected date. Please pick another date from the calendar.
                        </div>
                      )}
                    </div>

                    <div className="slot-legend">
                      <div className="legend-item">
                        <div className="legend-dot available" />
                        <span>Available</span>
                      </div>
                      <div className="legend-item">
                        <div className="legend-dot selected" />
                        <span>Selected</span>
                      </div>
                      <div className="legend-item">
                        <div className="legend-dot booked" />
                        <span>Booked / Unavailable</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Step 5: Details/Confirmation */}
          {bookingStep === 5 && (
            <div className="confirm-details-layout" style={{ animation: 'fadeIn 0.3s ease-out' }}>
              <div className="confirm-main-column">
                <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: '700', color: 'var(--ink)' }}>👨‍💼 Patient Information</h4>
                  <div className="confirm-details-grid">
                    <div className="confirm-detail-card">
                      <div className="confirm-detail-icon">👤</div>
                      <div className="confirm-detail-info">
                        <span className="confirm-detail-label">Name</span>
                        <span className="confirm-detail-val">{patientProfile?.user?.full_name || 'Patient'}</span>
                      </div>
                    </div>

                    <div className="confirm-detail-card">
                      <div className="confirm-detail-icon">📞</div>
                      <div className="confirm-detail-info">
                        <span className="confirm-detail-label">Phone</span>
                        <span className="confirm-detail-val">{patientProfile?.user?.phone || 'N/A'}</span>
                      </div>
                    </div>

                    <div className="confirm-detail-card">
                      <div className="confirm-detail-icon">🩸</div>
                      <div className="confirm-detail-info">
                        <span className="confirm-detail-label">Blood Group</span>
                        <span className="confirm-detail-val">{patientProfile?.blood_group || 'O+'}</span>
                      </div>
                    </div>

                    <div className="confirm-detail-card">
                      <div className="confirm-detail-icon">🎂</div>
                      <div className="confirm-detail-info">
                        <span className="confirm-detail-label">Age/Gender</span>
                        <span className="confirm-detail-val">
                          {patientProfile?.date_of_birth ? `${new Date().getFullYear() - new Date(patientProfile.date_of_birth).getFullYear()} yrs` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: '700', color: 'var(--ink)' }}>⚙️ Consultation Preferences</h4>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Treatment Concern / Type</label>
                    <select
                      value={treatmentType}
                      onChange={(e) => setTreatmentType(e.target.value)}
                      className="form-input"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      <option value="Routine Checkup">Routine Checkup</option>
                      <option value="Scaling & Polishing">Scaling & Polishing</option>
                      <option value="Root Canal Treatment (RCT)">Root Canal Treatment (RCT)</option>
                      <option value="Tooth Extraction">Tooth Extraction</option>
                      <option value="Braces Adjustment">Braces Adjustment</option>
                      <option value="Teeth Whitening">Teeth Whitening</option>
                      <option value="Other (Custom Concern)">Other (Custom Concern)</option>
                    </select>
                  </div>

                  {treatmentType === 'Other (Custom Concern)' && (
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                      <label className="form-label" style={{ fontWeight: 600 }}>Specify Custom Concern</label>
                      <input
                        type="text"
                        value={customTreatmentText}
                        onChange={(e) => setCustomTreatmentText(e.target.value)}
                        placeholder="Please specify your dental/clinical concern..."
                        className="form-input"
                        required
                      />
                    </div>
                  )}

                  {consultationType === 'teleconsultation' && (
                    <>
                      <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>Reason / Symptoms for Consultation</label>
                        <textarea
                          value={bookingSymptoms}
                          onChange={(e) => setBookingSymptoms(e.target.value)}
                          placeholder="Describe your symptoms..."
                          className="form-input" rows={3}
                          style={{ resize: 'vertical' }}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label className="form-label" style={{ fontWeight: 600 }}>Attach Previous Medical Report (Optional)</label>
                        <select
                          value={attachedReportId || ''}
                          onChange={(e) => setAttachedReportId(e.target.value || null)}
                          className="form-input"
                          style={{ background: 'var(--surface-2)' }}
                        >
                          <option value="">-- Select a report to attach --</option>
                          {dashboardData?.reports?.map((report: any) => (
                            <option key={report.id} value={report.id}>{report.title} ({report.report_type})</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>Notes for Doctor (Optional)</label>
                    <textarea
                      value={bookingNotes}
                      onChange={(e) => setBookingNotes(e.target.value)}
                      placeholder="Mention any other information you want the doctor to know..."
                      className="form-input" rows={3}
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                </div>

                <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
                  <h4 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: '700', color: 'var(--ink)' }}>🕒 What Happens Next?</h4>
                  <div className="booking-timeline">
                    <div className="booking-timeline-item">
                      <h5>Step 1: Instant Confirmation</h5>
                      <p>Upon clicking 'Confirm', your slot is locked instantly and you will receive an SMS and email notification.</p>
                    </div>
                    <div className="booking-timeline-item">
                      <h5>Step 2: Clinician Pre-Review</h5>
                      <p>Our medical team reviews your attached medical reports or symptoms description beforehand.</p>
                    </div>
                    <div className="booking-timeline-item">
                      <h5>Step 3: Consultation Day</h5>
                      <p>
                        {consultationType === 'teleconsultation'
                          ? 'Join the secure video meeting from the active rooms tab in your patient portal.'
                          : 'Arrive 10 minutes prior to your slot at the selected branch. Show confirmation on your phone.'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="confirm-sidebar-column">
                {renderSummarySidebar()}
                <div className="confirm-actions-panel" style={{ marginTop: '16px', background: 'var(--surface)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ width: '100%' }}
                    onClick={() => setBookingStep(4)}
                  >
                    ✏️ Edit Date & Slot
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Bottom: Wizard Footer Nav Bar */}
        <div className="book-footer" style={{ marginTop: '5px', padding: '16px 24px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {bookingStep > 1 ? (
            <button onClick={() => setBookingStep(bookingStep - 1)} className="btn-secondary" style={{ padding: '10px 20px' }}>
              ← Back
            </button>
          ) : (
            <div />
          )}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => { clearBookingWizardState(); setScreen('dashboard'); }} className="btn-secondary" style={{ padding: '10px 20px' }}>Cancel</button>
            {bookingStep < 5 ? (
              <button
                onClick={() => setBookingStep(bookingStep + 1)}
                disabled={
                  (bookingStep === 1 && !selectedBranchId) ||
                  (bookingStep === 2 && !consultationType) ||
                  (bookingStep === 3 && !selectedDoctorId) ||
                  (bookingStep === 4 && (!bookingDate || !bookingSlot))
                }
                className="btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 24px' }}
              >
                {bookingStep === 4 ? 'Continue to Details' : 'Continue'} <ChevronRight size={16} />
              </button>
            ) : (
              <button
                onClick={() => setShowBookingConfirm(true)}
                className="btn-primary"
                disabled={isLoading}
                style={{ padding: '10px 24px' }}
              >
                ✓ Confirm Appointment
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
