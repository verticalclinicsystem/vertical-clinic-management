import React from 'react';
import { Search, Users, UserCheck, AlertCircle, CheckCircle } from 'lucide-react';

interface RecepCheckInTabProps {
  checkInSearchQuery: string;
  setCheckInSearchQuery: (query: string) => void;
  appointments: any[];
  getLocalApptDate: (dateStr: string) => string;
  today: string;
  checkInFilteredAppointments: any[];
  selectedApptForCheckIn: any;
  setSelectedApptForCheckIn: (appt: any) => void;
  getLocalApptTime: (dateStr: string) => string;
  handleCheckIn: (apptId: string) => void;
  formatDocName: (name: string) => string;
}

export const RecepCheckInTab: React.FC<RecepCheckInTabProps> = ({
  checkInSearchQuery,
  setCheckInSearchQuery,
  appointments,
  getLocalApptDate,
  today,
  checkInFilteredAppointments,
  selectedApptForCheckIn,
  setSelectedApptForCheckIn,
  getLocalApptTime,
  handleCheckIn,
  formatDocName,
}) => {
  return (
    <div className="recep-checkin-container">
      {/* Left Column: Search & Patient List */}
      <div className="recep-checkin-search-section">
        <div className="recep-card">
          <div className="recep-card-header">
            <h3>Today's Patient List</h3>
          </div>
          <div className="recep-checkin-search-bar-wrapper">
            <Search size={18} className="recep-search-icon-inside" />
            <input
              type="text"
              className="recep-checkin-search-input"
              placeholder="Search today's patients by name, code or phone..."
              list="receptionist-today-patients-suggestions"
              value={checkInSearchQuery}
              onChange={(e) => setCheckInSearchQuery(e.target.value)}
            />
            <datalist id="receptionist-today-patients-suggestions">
              {Array.from(
                new Set(
                  (appointments || [])
                    .filter((a: any) => getLocalApptDate(a.appointment_datetime) === today)
                    .map((a: any) => a.patient?.user?.full_name || '')
                )
              ).map((name: any) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div className="recep-checkin-patient-list">
            {checkInFilteredAppointments.length === 0 ? (
              <div className="recep-empty-state" style={{ padding: '2rem' }}>
                <Users size={32} />
                <p>No patients scheduled for today.</p>
              </div>
            ) : (
              checkInFilteredAppointments.map((appt) => {
                const isSelected = selectedApptForCheckIn?.id === appt.id;
                const p = appt.patient;
                const timeStr = getLocalApptTime(appt.appointment_datetime);
                const [hour, minute] = timeStr.split(':');
                const formattedTime = `${parseInt(hour) % 12 || 12}:${minute} ${
                  parseInt(hour) >= 12 ? 'PM' : 'AM'
                }`;

                return (
                  <div
                    key={appt.id}
                    className={`recep-checkin-patient-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedApptForCheckIn(appt)}
                  >
                    <div className="patient-avatar-circle">
                      {p?.user?.full_name
                        ?.split(' ')
                        .map((n: string) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase() || 'PT'}
                    </div>
                    <div className="patient-details">
                      <span className="patient-name">{p?.user?.full_name || 'N/A'}</span>
                      <span className="patient-code-phone">
                        {p?.patient_code} &middot; {p?.user?.phone || '—'}
                      </span>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--primary)',
                          marginTop: '2px',
                          display: 'block',
                          fontWeight: 500,
                        }}
                      >
                        Time: {formattedTime} &middot; Reason: {appt.treatment_type}
                      </span>
                    </div>
                    <div className="patient-actions" onClick={(e) => e.stopPropagation()}>
                      {appt.status === 'completed' ? (
                        <span
                          className="badge badge-completed"
                          style={{
                            background: '#f0fdf4',
                            color: '#16a34a',
                            border: '1px solid #bbf7d0',
                          }}
                        >
                          Completed
                        </span>
                      ) : appt.status === 'in_consultation' ||
                        appt.status === 'In Consultation' ? (
                        <span
                          className="badge badge-confirmed"
                          style={{
                            background: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span style={{ width: '6px', height: '6px', backgroundColor: '#2563eb', borderRadius: '50%', flexShrink: 0, display: 'inline-block' }} />
                          In Consultation
                        </span>
                      ) : appt.status === 'checked_in' || appt.status === 'Waiting' ? (
                        <span className="badge badge-completed">Checked In</span>
                      ) : (
                        <button
                          className="recep-checkin-btn-action"
                          onClick={() => handleCheckIn(appt.id)}
                        >
                          <UserCheck size={16} /> Check In
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Today's Appointment Detail */}
      <div className="recep-checkin-detail-section">
        <div className="recep-card">
          <div className="recep-card-header">
            <h3>Appointment Details</h3>
          </div>

          {selectedApptForCheckIn ? (
            (() => {
              const appt = appointments.find((a) => a.id === selectedApptForCheckIn.id);
              if (!appt || appt.status === 'cancelled' || appt.status === 'rejected') {
                return (
                  <div className="recep-checkin-detail-empty">
                    <AlertCircle size={32} className="warning-icon" />
                    <p className="title">Appointment Cancelled or Rejected</p>
                    <p className="subtitle">This appointment is no longer active.</p>
                  </div>
                );
              }

              // Format appointment time
              const timeStr = getLocalApptTime(appt.appointment_datetime);
              const [hour, minute] = timeStr.split(':');
              const formattedTime = `${parseInt(hour) % 12 || 12}:${minute} ${
                parseInt(hour) >= 12 ? 'PM' : 'AM'
              }`;

              return (
                <div className="recep-checkin-detail-body">
                  <div className="detail-row">
                    <span className="label">Appointment ID</span>
                    <span className="value text-primary font-bold">
                      APT-{appt.id.slice(0, 5).toUpperCase()}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Patient Name</span>
                    <span className="value font-medium">{appt.patient?.user?.full_name}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Phone Number</span>
                    <span className="value font-medium">{appt.patient?.user?.phone || '—'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Reason / Type</span>
                    <span className="value font-medium">{appt.treatment_type}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Doctor Assigned</span>
                    <span className="value font-medium">
                      {formatDocName(appt.doctor?.user?.full_name || 'N/A')}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Scheduled Time</span>
                    <span className="value font-medium">{formattedTime}</span>
                  </div>
                  {appt.notes && (
                    <div className="detail-row" style={{ display: 'block', marginTop: '8px' }}>
                      <span className="label" style={{ display: 'block', marginBottom: '4px' }}>
                        Notes / Reason details
                      </span>
                      <span
                        className="value"
                        style={{
                          display: 'block',
                          padding: '8px',
                          backgroundColor: 'var(--surface-2)',
                          borderRadius: '6px',
                          fontSize: '0.85rem',
                        }}
                      >
                        {appt.notes}
                      </span>
                    </div>
                  )}

                  <div className="detail-divider"></div>

                  {appt.status === 'completed' ? (
                    <div
                      className="checked-in-status-box"
                      style={{
                        background: '#f0fdf4',
                        color: '#16a34a',
                        border: '1px solid #bbf7d0',
                        marginTop: '1rem',
                      }}
                    >
                      <CheckCircle size={20} /> Consultation Completed
                    </div>
                  ) : appt.status === 'in_consultation' || appt.status === 'In Consultation' ? (
                    <div
                      className="checked-in-status-box"
                      style={{
                        background: '#eff6ff',
                        color: '#2563eb',
                        border: '1px solid #bfdbfe',
                        marginTop: '1rem',
                      }}
                    >
                      <CheckCircle size={20} /> Currently In Consultation
                    </div>
                  ) : appt.status === 'checked_in' || appt.status === 'Waiting' ? (
                    <div className="checked-in-status-box">
                      <CheckCircle size={20} /> Checked In & Added to Queue
                    </div>
                  ) : (
                    <>
                      <p className="detail-notice">
                        Once checked in, the patient will be added to the queue and the doctor will be
                        notified automatically.
                      </p>
                      <button
                        className="recep-btn-primary full-width"
                        style={{ marginTop: '1.5rem' }}
                        onClick={() => handleCheckIn(appt.id)}
                      >
                        <UserCheck size={18} /> Check In Patient
                      </button>
                    </>
                  )}
                </div>
              );
            })()
          ) : (
            <div className="recep-checkin-detail-empty">
              <Users size={32} />
              <p className="title">Select a Patient</p>
              <p className="subtitle">
                Click on a patient from the list to view and verify their appointment details.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
