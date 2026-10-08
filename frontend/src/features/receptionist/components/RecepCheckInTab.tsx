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
  handleIntakeAndCheckIn?: (apptId: string, patientId: string, intakeData: any) => Promise<void>;
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
  handleIntakeAndCheckIn,
  formatDocName,
}) => {
  const [intakeBloodGroup, setIntakeBloodGroup] = React.useState<string>('O+');
  const [intakeHeight, setIntakeHeight] = React.useState<string>('');
  const [intakeWeight, setIntakeWeight] = React.useState<string>('');
  const [intakeAllergies, setIntakeAllergies] = React.useState<string>('');
  const [intakeChronic, setIntakeChronic] = React.useState<string>('');
  const [isSubmittingIntake, setIsSubmittingIntake] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (selectedApptForCheckIn?.patient) {
      const p = selectedApptForCheckIn.patient;
      setIntakeBloodGroup(p.blood_group || 'O+');
      setIntakeHeight(p.height || '');
      setIntakeWeight(p.weight || '');
      setIntakeAllergies(p.allergies && p.allergies !== 'None' ? p.allergies : '');
      setIntakeChronic(p.chronic_conditions && p.chronic_conditions !== 'None' ? p.chronic_conditions : '');
    }
  }, [selectedApptForCheckIn?.id]);
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
                      <span className="patient-name">
                        {p?.user?.full_name || 'N/A'}
                        {!p?.is_profile_completed && appt.status !== 'completed' && appt.status !== 'in_consultation' && appt.status !== 'In Consultation' && (
                          <span style={{
                            marginLeft: '6px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            backgroundColor: '#fffbeb',
                            color: '#b45309',
                            border: '1px solid #fde68a',
                            borderRadius: '4px',
                            padding: '1px 5px',
                            display: 'inline-block'
                          }}>
                            Intake Pending
                          </span>
                        )}
                      </span>
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
                  ) : !appt.patient?.is_profile_completed ? (
                    <div style={{
                      margin: '14px 0',
                      padding: '14px',
                      backgroundColor: '#fffbeb',
                      border: '1.5px solid #fde68a',
                      borderRadius: '12px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
                        <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>📋</span>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#92400e', fontWeight: 700 }}>
                            Front-Desk Clinical Intake (Profile Incomplete)
                          </h4>
                          <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#b45309' }}>
                            Patient has not filled clinical profile online. Record vitals & alerts before sending to doctor.
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#78350f', marginBottom: '2px' }}>
                            Blood Group
                          </label>
                          <select
                            value={intakeBloodGroup}
                            onChange={(e) => setIntakeBloodGroup(e.target.value)}
                            style={{ width: '100%', padding: '5px 6px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}
                          >
                            <option value="A+">A+</option>
                            <option value="A-">A-</option>
                            <option value="B+">B+</option>
                            <option value="B-">B-</option>
                            <option value="AB+">AB+</option>
                            <option value="AB-">AB-</option>
                            <option value="O+">O+</option>
                            <option value="O-">O-</option>
                            <option value="Unknown">Unknown</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#78350f', marginBottom: '2px' }}>
                            Height (cm)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 172"
                            value={intakeHeight}
                            onChange={(e) => setIntakeHeight(e.target.value)}
                            style={{ width: '100%', padding: '5px 6px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#78350f', marginBottom: '2px' }}>
                            Weight (kg)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 68"
                            value={intakeWeight}
                            onChange={(e) => setIntakeWeight(e.target.value)}
                            style={{ width: '100%', padding: '5px 6px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}
                          />
                        </div>
                      </div>

                      <div style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#78350f' }}>Known Allergies</label>
                          <div style={{ display: 'flex', gap: '3px' }}>
                            {['No Known Allergies', 'Penicillin', 'Sulfa'].map((chip) => (
                              <button
                                key={chip}
                                type="button"
                                onClick={() => setIntakeAllergies(chip)}
                                style={{ fontSize: '0.66rem', padding: '1px 5px', borderRadius: '4px', border: '1px solid #d97706', backgroundColor: '#fef3c7', color: '#92400e', cursor: 'pointer' }}
                              >
                                +{chip}
                              </button>
                            ))}
                          </div>
                        </div>
                        <input
                          type="text"
                          placeholder="e.g. Penicillin, Sulfa, None"
                          value={intakeAllergies}
                          onChange={(e) => setIntakeAllergies(e.target.value)}
                          style={{ width: '100%', padding: '5px 8px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}
                        />
                      </div>

                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#78350f' }}>Chronic Conditions</label>
                          <div style={{ display: 'flex', gap: '3px' }}>
                            {['None', 'Diabetes', 'Hypertension'].map((chip) => (
                              <button
                                key={chip}
                                type="button"
                                onClick={() => setIntakeChronic(chip)}
                                style={{ fontSize: '0.66rem', padding: '1px 5px', borderRadius: '4px', border: '1px solid #d97706', backgroundColor: '#fef3c7', color: '#92400e', cursor: 'pointer' }}
                              >
                                +{chip}
                              </button>
                            ))}
                          </div>
                        </div>
                        <input
                          type="text"
                          placeholder="e.g. Diabetes, Hypertension, None"
                          value={intakeChronic}
                          onChange={(e) => setIntakeChronic(e.target.value)}
                          style={{ width: '100%', padding: '5px 8px', fontSize: '0.8rem', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff' }}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          disabled={isSubmittingIntake}
                          onClick={async () => {
                            if (!handleIntakeAndCheckIn || !appt.patient) return;
                            setIsSubmittingIntake(true);
                            try {
                              await handleIntakeAndCheckIn(appt.id, appt.patient.id, {
                                blood_group: intakeBloodGroup,
                                height: intakeHeight,
                                weight: intakeWeight,
                                allergies: intakeAllergies || 'No Known Allergies',
                                chronic_conditions: intakeChronic || 'None',
                              });
                            } finally {
                              setIsSubmittingIntake(false);
                            }
                          }}
                          className="recep-btn-primary"
                          style={{
                            flex: 1,
                            padding: '10px 14px',
                            fontSize: '0.86rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px'
                          }}
                        >
                          <UserCheck size={16} /> {isSubmittingIntake ? 'Saving...' : 'Save Intake & Check In'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCheckIn(appt.id)}
                          style={{
                            padding: '10px 12px',
                            fontSize: '0.8rem',
                            border: '1px solid #cbd5e1',
                            backgroundColor: '#ffffff',
                            borderRadius: '8px',
                            color: '#64748b',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                          title="Skip intake and check-in directly"
                        >
                          Skip Intake
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: '8px',
                        margin: '12px 0',
                        fontSize: '0.82rem',
                        color: '#166534'
                      }}>
                        <span>✓ Clinical Profile Complete ({appt.patient?.blood_group || 'Blood Group on file'}, Allergies: {appt.patient?.allergies || 'None'})</span>
                      </div>
                      <p className="detail-notice">
                        Once checked in, the patient will be added to the queue and the doctor will be
                        notified automatically.
                      </p>
                      <button
                        className="recep-btn-primary full-width"
                        style={{ marginTop: '1rem' }}
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
