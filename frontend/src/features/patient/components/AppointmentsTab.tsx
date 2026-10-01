import React, { useState } from 'react';
import { Stethoscope, MapPin, MoreVertical, Clock, Video, Calendar, X, AlertTriangle, Check, ArrowRight } from 'lucide-react';
import { CustomDatePicker } from '../../../components/CustomDatePicker';
import { api } from '../../../services/api';

interface AppointmentsTabProps {
  dashboardData: any;
  appointmentFilter: 'all' | 'upcoming' | 'completed' | 'cancelled';
  setAppointmentFilter: (filter: 'all' | 'upcoming' | 'completed' | 'cancelled') => void;
  appointmentDateFilter: string;
  setAppointmentDateFilter: (date: string) => void;
  setScreen: (screen: any) => void;
  setBookingStep: (step: number) => void;
  openRescheduleModal: (apptId: string, doctorId: string, type?: string) => void;
  setCancelApptId: (id: string | null) => void;
  handleJoinMeeting: (id: string) => void;
  setViewingAppointment: (appt: any) => void;
  triggerToast: (type: 'success' | 'error', message: string) => void;
  onRefresh?: () => void;
}



export const AppointmentsTab: React.FC<AppointmentsTabProps> = ({
  dashboardData,
  appointmentFilter,
  setAppointmentFilter,
  appointmentDateFilter,
  setAppointmentDateFilter,
  setScreen,
  setBookingStep,
  openRescheduleModal,
  setCancelApptId,
  handleJoinMeeting,
  setViewingAppointment,
  triggerToast,
  onRefresh,
}) => {
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(appointmentDateFilter || '');
  const [endDate, setEndDate] = useState<string>('');
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const handleAcceptReassignment = async (apptId: string) => {
    setAcceptingId(apptId);
    try {
      const res = await api.post(`/appointments/${apptId}/accept-reassign`);
      if (res.data?.success) {
        triggerToast('success', 'Doctor reassignment accepted! Your appointment is confirmed.');
        if (onRefresh) onRefresh();
      } else {
        triggerToast('error', res.data?.message || 'Failed to accept reassignment.');
      }
    } catch (err: any) {
      console.error('Accept reassignment error:', err);
      triggerToast('error', err.response?.data?.message || 'Failed to accept reassignment.');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleStartDateChange = (date: string) => {
    setStartDate(date);
    setAppointmentDateFilter(date);
    if (date && endDate && date > endDate) {
      setEndDate(date);
    }
  };

  const handleEndDateChange = (date: string) => {
    if (startDate && date && date < startDate) {
      setEndDate(startDate);
    } else {
      setEndDate(date);
    }
  };

  const handleClearDates = () => {
    setStartDate('');
    setEndDate('');
    setAppointmentDateFilter('');
  };

  if (!dashboardData) return null;

  const allAppts: any[] = [
    ...(dashboardData.upcoming_appointments || []),
    ...(dashboardData.past_appointments || []),
  ];

  // Conflicted appointments waiting for patient confirmation
  const pendingReassignments = allAppts.filter((a: any) => a.status === 'reassigned_pending');

  const filteredAppts = allAppts.filter((appt: any) => {
    if (appointmentFilter === 'upcoming') {
      if (!['scheduled', 'confirmed', 'in_progress', 'rescheduled', 'reassigned_pending'].includes(appt.status)) return false;
    } else if (appointmentFilter === 'completed') {
      if (appt.status !== 'completed') return false;
    } else if (appointmentFilter === 'cancelled') {
      if (appt.status !== 'cancelled') return false;
    }

    if (startDate || endDate || appointmentDateFilter) {
      const apptDate = appt.appointment_datetime ? appt.appointment_datetime.split('T')[0] : '';
      if (startDate && apptDate < startDate) return false;
      if (endDate && apptDate > endDate) return false;
      if (!startDate && !endDate && appointmentDateFilter && apptDate !== appointmentDateFilter) return false;
    }

    return true;
  });

  return (
    <div className="card">
      <div className="card-title-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <h3 className="card-title" style={{ margin: 0 }}><Calendar size={18} /> My Appointments</h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>From:</label>
              <div style={{ width: '145px' }}>
                <CustomDatePicker
                  value={startDate}
                  maxDate={endDate || undefined}
                  onChange={handleStartDateChange}
                  placeholder="Start Date"
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>To:</label>
              <div style={{ width: '145px' }}>
                <CustomDatePicker
                  value={endDate}
                  minDate={startDate || undefined}
                  onChange={handleEndDateChange}
                  placeholder="End Date"
                />
              </div>
            </div>

            {(startDate || endDate) && (
              <button
                type="button"
                onClick={handleClearDates}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 10px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--muted, #64748b)',
                  backgroundColor: 'var(--surface-2, #f1f5f9)',
                  border: '1px solid var(--border, #cbd5e1)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  height: '38px'
                }}
                title="Clear date filter"
              >
                <X size={14} /> Clear
              </button>
            )}
          </div>

          <button
            onClick={() => { setBookingStep(1); setScreen('book'); }}
            className="btn-primary"
            style={{ padding: '8px 14px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}
          >
            + Book Appointment
          </button>
        </div>
      </div>

      {/* ── Pending Reassignment Action Banner ── */}
      {pendingReassignments.length > 0 && (
        <div style={{
          margin: '16px 24px 8px 24px',
          padding: '16px 20px',
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          boxShadow: '0 2px 6px rgba(245, 158, 11, 0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#92400e', fontWeight: 700, fontSize: '0.94rem' }}>
            <AlertTriangle size={20} style={{ color: '#d97706', flexShrink: 0 }} />
            <span>Doctor Leave Conflict — Action Required on Your Appointment ({pendingReassignments.length})</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pendingReassignments.map((reAppt) => {
              const prevDocName = reAppt.previous_doctor?.user?.full_name || reAppt.previous_doctor?.full_name || 'Your Doctor';
              const newDocName = reAppt.doctor?.user?.full_name || reAppt.doctor?.full_name || 'Assigned Doctor';
              const formattedDt = new Date(reAppt.appointment_datetime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

              return (
                <div 
                  key={reAppt.id}
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #fef3c7',
                    padding: '14px 18px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '14px'
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 500 }}>
                      <strong style={{ color: '#d97706' }}>Dr. {prevDocName}</strong> is on approved leave. 
                      Your appointment on <strong>{formattedDt}</strong> has been reassigned to <strong style={{ color: 'var(--primary-teal, #0d9488)' }}>Dr. {newDocName}</strong>.
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span>Branch: {reAppt.branch?.name}</span>
                      <span>•</span>
                      <span>Plan: {reAppt.treatment_type}</span>
                      <span>•</span>
                      <span>Mode: {reAppt.consultation_type === 'in_person' ? 'In Person' : 'Video Call'}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleAcceptReassignment(reAppt.id)}
                      disabled={acceptingId === reAppt.id}
                      style={{
                        padding: '7px 14px',
                        backgroundColor: '#10b981',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        cursor: acceptingId === reAppt.id ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 1px 3px rgba(16, 185, 129, 0.3)'
                      }}
                    >
                      <Check size={14} /> {acceptingId === reAppt.id ? 'Confirming...' : 'Accept & Confirm'}
                    </button>

                    <button
                      type="button"
                      onClick={() => openRescheduleModal(reAppt.id, reAppt.doctor_id, reAppt.consultation_type)}
                      style={{
                        padding: '7px 12px',
                        backgroundColor: '#f1f5f9',
                        color: '#334155',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Clock size={14} /> Reschedule
                    </button>

                    <button
                      type="button"
                      onClick={() => setCancelApptId(reAppt.id)}
                      style={{
                        padding: '7px 12px',
                        backgroundColor: '#fee2e2',
                        color: '#991b1b',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <X size={14} /> Cancel
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 24px',
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: '#f8fafc',
        flexWrap: 'wrap'
      }}>
        {[
          { value: 'all', label: 'All Appointments' },
          { value: 'upcoming', label: 'Upcoming' },
          { value: 'completed', label: 'Completed' },
          { value: 'cancelled', label: 'Cancelled' },
        ].map((tab) => {
          const isActive = appointmentFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setAppointmentFilter(tab.value as any)}
              style={{
                padding: '6px 16px',
                borderRadius: '20px',
                border: '1px solid',
                borderColor: isActive ? 'var(--primary-teal)' : '#cbd5e1',
                backgroundColor: isActive ? 'var(--primary-teal)' : '#ffffff',
                color: isActive ? '#ffffff' : '#475569',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isActive ? '0 2px 6px rgba(12, 110, 140, 0.2)' : 'none'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="table-container">
        <table className="portal-table">
          <thead>
            <tr>
              <th>Doctor</th>
              <th>Branch</th>
              <th>Date &amp; Time</th>
              <th>Treatment Plan</th>
              <th>Consultation</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredAppts.map((appt: any, apptIdx: number) => {
              const isNearBottom = apptIdx >= Math.max(0, filteredAppts.length - 2);
              const isReassignedPending = appt.status === 'reassigned_pending';

              return (
                <tr
                  key={appt.id}
                  style={{ cursor: 'pointer', backgroundColor: isReassignedPending ? 'rgba(254, 243, 199, 0.25)' : undefined }}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.tagName.toLowerCase() === 'button' || target.closest('button') || target.closest('a')) {
                      return;
                    }
                    setViewingAppointment(appt);
                  }}
                >
                  <td style={{ fontWeight: 600 }}>
                    <Stethoscope size={13} style={{ display: 'inline', marginRight: '5px', color: 'var(--primary-teal)' }} />
                    {appt.doctor?.user?.full_name?.toLowerCase().startsWith('dr') ? appt.doctor?.user?.full_name : `Dr. ${appt.doctor?.user?.full_name}`}
                    {isReassignedPending && (
                      <div style={{ fontSize: '0.74rem', color: '#b45309', fontWeight: 600, marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <ArrowRight size={11} /> Reassigned from Dr. {appt.previous_doctor?.user?.full_name || appt.previous_doctor?.full_name || 'Original Doctor'}
                      </div>
                    )}
                  </td>
                  <td><MapPin size={13} style={{ display: 'inline', marginRight: '4px', color: '#64748b' }} />{appt.branch?.name}</td>
                  <td>{new Date(appt.appointment_datetime).toLocaleString()}</td>
                  <td>{appt.treatment_type}</td>
                  <td>{appt.consultation_type === 'in_person' ? 'In Person' : 'Video Consultation'}</td>
                  <td>
                    {isReassignedPending ? (
                      <span className="status-pill reassigned-pending" style={{ backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontWeight: 700 }}>
                        Action Required
                      </span>
                    ) : (
                      <span className={`status-pill ${appt.status.replace(/_/g, '-')}`}>{appt.status.replace(/[_-]/g, ' ')}</span>
                    )}
                  </td>
                  <td>
                    {isReassignedPending ? (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcceptReassignment(appt.id);
                          }}
                          disabled={acceptingId === appt.id}
                          style={{
                            padding: '5px 10px',
                            backgroundColor: '#10b981',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            cursor: acceptingId === appt.id ? 'not-allowed' : 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Accept reassigned doctor"
                        >
                          <Check size={12} /> {acceptingId === appt.id ? '...' : 'Accept'}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openRescheduleModal(appt.id, appt.doctor_id, appt.consultation_type);
                          }}
                          style={{
                            padding: '5px 8px',
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Pick another slot or doctor"
                        >
                          <Clock size={12} />
                        </button>
                      </div>
                    ) : ['confirmed', 'scheduled', 'rescheduled', 'pending'].includes(appt.status) ? (
                      <div className="action-dropdown-container">
                        <button
                          className={`dropdown-trigger ${activeDropdownId === appt.id ? 'active' : ''}`}
                          onClick={() => setActiveDropdownId(activeDropdownId === appt.id ? null : appt.id)}
                          title="Actions"
                        >
                          <MoreVertical size={16} />
                        </button>
                        {activeDropdownId === appt.id && (() => {
                          const isLimitReached = (appt.reschedule_count || 0) >= 2;
                          const apptTime = new Date(appt.appointment_datetime).getTime();
                          const isWithinTwoHours = apptTime - Date.now() < 2 * 60 * 60 * 1000;

                          return (
                            <div className={`action-dropdown-menu ${isNearBottom ? 'open-up' : ''}`}>
                              {appt.consultation_type === 'teleconsultation' && (
                                <button onClick={() => { handleJoinMeeting(appt.id); setActiveDropdownId(null); }}>
                                  <Video size={13} style={{ color: 'var(--primary-teal)' }} /> Join Call
                                </button>
                              )}
                              <button
                                style={isLimitReached || isWithinTwoHours ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                onClick={() => {
                                  if (isLimitReached) {
                                    triggerToast('error', 'Maximum reschedule limit reached. Please contact receptionist to update your appointment.');
                                    return;
                                  }
                                  if (isWithinTwoHours) {
                                    triggerToast('error', 'Rescheduling is not allowed within 2 hours of the scheduled time. Please call the clinic.');
                                    return;
                                  }
                                  openRescheduleModal(appt.id, appt.doctor_id, appt.consultation_type);
                                  setActiveDropdownId(null);
                                }}
                              >
                                <Clock size={13} style={{ color: 'var(--primary-teal)' }} /> Reschedule
                              </button>
                              <button
                                className="cancel-item"
                                style={isWithinTwoHours ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                                onClick={() => {
                                  if (isWithinTwoHours) {
                                    triggerToast('error', 'Cancellation is not allowed within 2 hours of the scheduled time. Please call the clinic.');
                                    return;
                                  }
                                  setCancelApptId(appt.id);
                                  setActiveDropdownId(null);
                                }}
                              >
                                <X size={13} style={{ color: '#dc2626' }} /> Cancel
                              </button>
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <span className="action-muted-text">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {filteredAppts.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '30px 0' }}>No appointments found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
