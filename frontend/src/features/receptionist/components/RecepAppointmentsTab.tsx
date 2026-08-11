import React from 'react';
import { CalendarPlus, Users, X, Clock, Trash2 } from 'lucide-react';

interface RecepAppointmentsTabProps {
  calendarDate: string;
  setCalendarDate: (date: string) => void;
  selectedCalendarAppt: any;
  setSelectedCalendarAppt: (appt: any) => void;
  calendarAppointments: any[];
  setShowBookModal: (show: boolean) => void;
  doctors: any[];
  selectedBranchId: string;
  formatDocName: (name: string) => string;
  getLocalApptTime: (dateStr: string) => string;
  getLocalApptDate: (dateStr: string) => string;
  appointments: any[];
  rescheduleApptId: string | null;
  setRescheduleApptId: (id: string | null) => void;
  rescheduleDate: string;
  setRescheduleDate: (date: string) => void;
  rescheduleTime: string;
  setRescheduleTime: (time: string) => void;
  rescheduleConsultationType: string;
  setRescheduleConsultationType: (type: string) => void;
  isCustomTimeReschedule: boolean;
  setIsCustomTimeReschedule: (custom: boolean) => void;
  loadingRescheduleSlots: boolean;
  rescheduleSlots: any[];
  handleRescheduleSubmit: () => void;
  handleCheckIn: (apptId: string) => void;
  handleCancel: (apptId: string) => void;
  setBillingForm: (form: any) => void;
  setActiveTab: (tab: string) => void;
  setSelectedApptDetails: (appt: any) => void;
  getLocalTodayDate: () => string;
}

export const RecepAppointmentsTab: React.FC<RecepAppointmentsTabProps> = ({
  calendarDate,
  setCalendarDate,
  selectedCalendarAppt,
  setSelectedCalendarAppt,
  calendarAppointments,
  setShowBookModal,
  doctors,
  selectedBranchId,
  formatDocName,
  getLocalApptTime,
  getLocalApptDate,
  appointments,
  rescheduleApptId,
  setRescheduleApptId,
  rescheduleDate,
  setRescheduleDate,
  rescheduleTime,
  setRescheduleTime,
  rescheduleConsultationType,
  setRescheduleConsultationType,
  isCustomTimeReschedule,
  setIsCustomTimeReschedule,
  loadingRescheduleSlots,
  rescheduleSlots,
  handleRescheduleSubmit,
  handleCheckIn,
  handleCancel,
  setBillingForm,
  setActiveTab,
  setSelectedApptDetails,
  getLocalTodayDate,
}) => {
  const formatTimeToAMPM = (timeStr: string) => {
    if (!timeStr) return '';
    try {
      const timePart = timeStr.includes('T') ? getLocalApptTime(timeStr) : timeStr.slice(0, 5);
      const [hours, minutes] = timePart.split(':').map(Number);
      const ampm = hours >= 12 ? 'PM' : 'AM';
      const formattedHours = hours % 12 || 12;
      return `${formattedHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    } catch (e) {
      return timeStr;
    }
  };

  return (
    <div className="recep-calendar-view">
      {/* Calendar Toolbar */}
      <div className="recep-calendar-toolbar">
        <div className="toolbar-left">
          <div className="date-picker-container">
            <label htmlFor="calendar-date-input">Select Date</label>
            <input
              id="calendar-date-input"
              type="date"
              className="calendar-date-input"
              value={calendarDate}
              onChange={(e) => {
                setCalendarDate(e.target.value);
                setSelectedCalendarAppt(null);
              }}
            />
          </div>
          <div className="calendar-date-display">
            <h3>
              {new Date(calendarDate).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </h3>
            <span className="calendar-subtitle">
              {calendarAppointments.length} appointment{calendarAppointments.length !== 1 ? 's' : ''} scheduled
            </span>
          </div>
        </div>

        <div className="toolbar-right">
          <button className="recep-btn-primary" onClick={() => setShowBookModal(true)}>
            <CalendarPlus size={16} /> New Appointment
          </button>
        </div>
      </div>

      <div className="recep-calendar-split-container">
        {/* Left side: Calendar Grid */}
        <div className="recep-calendar-grid-card">
          {doctors.filter((d) => d.branch_id === selectedBranchId).length === 0 ? (
            <div className="recep-empty-state">
              <Users size={48} />
              <p>No doctors assigned to this branch.</p>
            </div>
          ) : (
            <div className="calendar-table-wrapper">
              <table className="calendar-grid-table">
                <thead>
                  <tr>
                    <th className="time-col-header">Time</th>
                    {doctors
                      .filter((d) => d.branch_id === selectedBranchId)
                      .map((doc) => (
                        <th key={doc.id} className="doc-col-header">
                          {formatDocName(doc.user?.full_name || 'Staff')}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: '09:00 AM', hour24: 9 },
                    { label: '10:00 AM', hour24: 10 },
                    { label: '11:00 AM', hour24: 11 },
                    { label: '12:00 PM', hour24: 12 },
                    { label: '01:00 PM', hour24: 13 },
                    { label: '02:00 PM', hour24: 14 },
                    { label: '03:00 PM', hour24: 15 },
                    { label: '04:00 PM', hour24: 16 },
                    { label: '05:00 PM', hour24: 17 },
                    { label: '06:00 PM', hour24: 18 },
                    { label: '07:00 PM', hour24: 19 },
                    { label: '08:00 PM', hour24: 20 },
                    { label: '09:00 PM', hour24: 21 },
                  ].map((slot) => {
                    return (
                      <tr key={slot.hour24}>
                        <td className="time-cell">{slot.label}</td>
                        {doctors
                          .filter((d) => d.branch_id === selectedBranchId)
                          .map((doc) => {
                            const cellAppts = calendarAppointments.filter((a) => {
                              const localTime = getLocalApptTime(a.appointment_datetime);
                              const apptHour = parseInt(localTime.split(':')[0] || '-1', 10);
                              return a.doctor_id === doc.id && apptHour === slot.hour24;
                            });

                            return (
                              <td key={doc.id} className="calendar-grid-cell">
                                {cellAppts.length === 0 ? (
                                  <span className="empty-cell-dash">—</span>
                                ) : (
                                  <div className="cell-pills-container">
                                    {cellAppts.map((appt) => {
                                      const isSelected = selectedCalendarAppt?.id === appt.id;
                                      return (
                                        <div
                                          key={appt.id}
                                          className={`calendar-appt-pill ${appt.status} ${isSelected ? 'selected' : ''}`}
                                          onClick={() => setSelectedCalendarAppt(appt)}
                                        >
                                          <span className="pill-patient-name">
                                            {appt.patient?.user?.full_name || 'Walk-in'}
                                          </span>
                                          <span className="pill-appt-time">
                                            {getLocalApptTime(appt.appointment_datetime)}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right side: Sidebar Pane */}
        <div className="recep-calendar-sidebar-card">
          {selectedCalendarAppt ? (
            (() => {
              const appt = appointments.find((a) => a.id === selectedCalendarAppt.id) || selectedCalendarAppt;
              return (
                <div className="calendar-appt-detail-pane">
                  <div className="detail-pane-header">
                    <h4>Appointment Details</h4>
                    <button className="btn-close-detail" onClick={() => setSelectedCalendarAppt(null)}>
                      <X size={16} />
                    </button>
                  </div>

                  <div className="detail-pane-body">
                    <div className="detail-status-section">
                      <span className={`badge badge-${appt.status}`}>{appt.status?.replace('_', ' ')}</span>
                      <span className={`badge-consultation ${appt.consultation_type}`}>
                        {appt.consultation_type === 'teleconsultation' ? 'Teleconsult' : 'In-Person'}
                      </span>
                    </div>

                    <div className="detail-section">
                      <span className="section-label">Patient Details</span>
                      <div className="detail-info-block">
                        <div className="info-row">
                          <strong>Name:</strong>
                          <span>{appt.patient?.user?.full_name || 'Walk-in'}</span>
                        </div>
                        <div className="info-row">
                          <strong>Code:</strong>
                          <span className="mono-text">{appt.patient?.patient_code || '—'}</span>
                        </div>
                        <div className="info-row">
                          <strong>Phone:</strong>
                          <span>{appt.patient?.user?.phone || '—'}</span>
                        </div>
                        <div className="info-row">
                          <strong>Email:</strong>
                          <span>{appt.patient?.user?.email || '—'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="detail-section">
                      <span className="section-label">Schedule Info</span>
                      <div className="detail-info-block">
                        <div className="info-row">
                          <strong>Date:</strong>
                          <span>{getLocalApptDate(appt.appointment_datetime)}</span>
                        </div>
                        <div className="info-row">
                          <strong>Day:</strong>
                          <span>
                            {new Date(getLocalApptDate(appt.appointment_datetime)).toLocaleDateString('en-US', {
                              weekday: 'long',
                            })}
                          </span>
                        </div>
                        <div className="info-row">
                          <strong>Time Slot:</strong>
                          <span className="time-highlight">
                            {formatTimeToAMPM(getLocalApptTime(appt.appointment_datetime))}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="detail-section">
                      <span className="section-label">Clinical Info</span>
                      <div className="detail-info-block">
                        <div className="info-row">
                          <strong>Doctor:</strong>
                          <span>{formatDocName(appt.doctor?.user?.full_name || 'Staff')}</span>
                        </div>
                        <div className="info-row">
                          <strong>Treatment:</strong>
                          <span>{appt.treatment_type}</span>
                        </div>
                        {appt.notes && (
                          <div className="info-notes-row">
                            <strong>Notes:</strong>
                            <p>{appt.notes}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="detail-pane-actions">
                      {rescheduleApptId === appt.id ? (
                        <div
                          className="reschedule-panel"
                          style={{
                            marginTop: '12px',
                            padding: '12px',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            backgroundColor: '#f8fafc',
                            width: '100%',
                          }}
                        >
                          <h5 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', color: '#1e293b' }}>
                            Reschedule Appointment
                          </h5>
                          <div className="form-group" style={{ marginBottom: '8px' }}>
                            <label
                              style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px', fontWeight: 'bold' }}
                            >
                              New Date
                            </label>
                            <input
                              type="date"
                              value={rescheduleDate}
                              onChange={(e) => {
                                setRescheduleDate(e.target.value);
                                setRescheduleTime('');
                              }}
                              style={{
                                width: '100%',
                                padding: '6px',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                fontSize: '0.85rem',
                              }}
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: '8px' }}>
                            <label
                              style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px', fontWeight: 'bold' }}
                            >
                              Consultation Type
                            </label>
                            <select
                              value={rescheduleConsultationType}
                              onChange={(e) => setRescheduleConsultationType(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '6px',
                                border: '1px solid #cbd5e1',
                                borderRadius: '4px',
                                fontSize: '0.85rem',
                              }}
                            >
                              <option value="in_person">In-Clinic Visit</option>
                              <option value="teleconsultation">Teleconsultation</option>
                            </select>
                          </div>
                          <div className="form-group" style={{ marginBottom: '12px' }}>
                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '4px',
                              }}
                            >
                              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', margin: 0 }}>
                                Available Time Slot
                              </label>
                              <button
                                type="button"
                                onClick={() => setIsCustomTimeReschedule(!isCustomTimeReschedule)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#0d9488',
                                  fontSize: '0.75rem',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  padding: 0,
                                }}
                              >
                                {isCustomTimeReschedule ? 'Select from list' : '✍️ Custom Time'}
                              </button>
                            </div>
                            {isCustomTimeReschedule ? (
                              <input
                                type="time"
                                value={rescheduleTime}
                                onChange={(e) => setRescheduleTime(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '6px',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '4px',
                                  fontSize: '0.85rem',
                                }}
                              />
                            ) : loadingRescheduleSlots ? (
                              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Loading slots...</div>
                            ) : (
                              <select
                                value={rescheduleTime}
                                onChange={(e) => setRescheduleTime(e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '6px',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '4px',
                                  fontSize: '0.85rem',
                                }}
                              >
                                <option value="">-- Select Time Slot --</option>
                                {rescheduleSlots.map((s) => {
                                  let label = formatTimeToAMPM(s.time);
                                  const isExpired = s.status === 'expired';
                                  if (s.status === 'booked') {
                                    label += ' (Booked)';
                                  } else if (isExpired) {
                                    label += ' (Expired)';
                                  } else if (s.status === 'lunch_break') {
                                    label += ' (Lunch Break)';
                                  } else if (s.status === 'tele_only') {
                                    label += ' (Tele Only)';
                                  } else if (s.status === 'in_clinic_only') {
                                    label += ' (In-Clinic Only)';
                                  }
                                  const isApptInPast =
                                    appt.status === 'no_show' || new Date(appt.appointment_datetime) < new Date();
                                  const isTypeMismatch =
                                    (rescheduleConsultationType === 'in_person' && s.status === 'tele_only') ||
                                    (rescheduleConsultationType === 'teleconsultation' && s.status === 'in_clinic_only');
                                  const isDisabled =
                                    (isExpired && !isApptInPast) ||
                                    s.status === 'booked' ||
                                    s.status === 'lunch_break' ||
                                    isTypeMismatch;
                                  return (
                                    <option key={s.time} value={s.time} disabled={isDisabled}>
                                      {label}
                                    </option>
                                  );
                                })}
                              </select>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={handleRescheduleSubmit}
                              className="recep-btn-primary"
                              style={{ flex: 1, padding: '6px', fontSize: '0.85rem' }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setRescheduleApptId(null);
                                setRescheduleDate('');
                                setRescheduleTime('');
                              }}
                              className="btn-cancel"
                              style={{
                                flex: 1,
                                padding: '6px',
                                fontSize: '0.85rem',
                                border: '1px solid #cbd5e1',
                                background: '#fff',
                                borderRadius: '4px',
                                cursor: 'pointer',
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {(appt.status === 'pending' || appt.status === 'confirmed') && (
                            <button
                              className="btn-checkin-appt"
                              onClick={() => handleCheckIn(appt.id)}
                              style={{ width: '100%' }}
                            >
                              Check In Patient
                            </button>
                          )}
                          {(appt.status === 'pending' || appt.status === 'confirmed') && (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px', width: '100%' }}>
                              <button
                                className="btn-reschedule-appt"
                                onClick={() => {
                                  setRescheduleApptId(appt.id);
                                  setRescheduleDate(getLocalTodayDate());
                                  setRescheduleConsultationType(appt.consultation_type || 'in_person');
                                  setIsCustomTimeReschedule(false);
                                }}
                                style={{
                                  flex: 1,
                                  padding: '8px',
                                  fontSize: '0.85rem',
                                  background: '#f1f5f9',
                                  border: '1px solid #cbd5e1',
                                  borderRadius: '6px',
                                  color: '#334155',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Clock size={14} /> Reschedule
                              </button>
                              <button
                                className="btn-cancel-appt-action"
                                onClick={() => handleCancel(appt.id)}
                                style={{
                                  flex: 1,
                                  padding: '8px',
                                  fontSize: '0.85rem',
                                  background: '#fee2e2',
                                  border: '1px solid #fecaca',
                                  borderRadius: '6px',
                                  color: '#dc2626',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '4px',
                                }}
                              >
                                <Trash2 size={14} /> Cancel
                              </button>
                            </div>
                          )}
                        </>
                      )}
                      {appt.status === 'completed' && (
                        <button
                          className="btn-create-invoice-appt"
                          onClick={() => {
                            setBillingForm({
                              patient_id: appt.patient_id,
                              total_amount: appt.doctor?.consultation_fee || 500,
                              discount_amount: 0,
                              tax_amount: 0,
                            });
                            setActiveTab('billing');
                          }}
                        >
                          Generate Invoice
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="calendar-timeline-pane">
              <h4 className="timeline-title">Day Timeline</h4>
              <span className="timeline-date">
                {new Date(calendarDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>

              <div className="timeline-items-container">
                {calendarAppointments.length === 0 ? (
                  <div className="timeline-empty">
                    <Clock size={32} />
                    <p>No appointments for this date.</p>
                  </div>
                ) : (
                  calendarAppointments
                    .sort((a, b) => a.appointment_datetime.localeCompare(b.appointment_datetime))
                    .map((appt) => {
                      const timePart = getLocalApptTime(appt.appointment_datetime);
                      return (
                        <div
                          key={appt.id}
                          className={`timeline-item-card status-${appt.status}`}
                          onClick={() => {
                            setSelectedCalendarAppt(appt);
                            setSelectedApptDetails(appt);
                          }}
                        >
                          <div className="timeline-item-time">{timePart}</div>
                          <div className="timeline-item-content">
                            <h5>{appt.patient?.user?.full_name || 'Walk-in'}</h5>
                            <span className="timeline-item-sub">
                              {formatDocName(appt.doctor?.user?.full_name || 'Staff')} • {appt.treatment_type}
                            </span>
                          </div>
                          <div className={`timeline-item-status status-${appt.status}`} />
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
