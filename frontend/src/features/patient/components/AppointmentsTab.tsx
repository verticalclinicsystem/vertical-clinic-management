import React, { useState } from 'react';
import { Stethoscope, MapPin, MoreVertical, Clock, Video, Calendar, X } from 'lucide-react';
import { CustomDatePicker } from '../../../components/CustomDatePicker';

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
}) => {
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  if (!dashboardData) return null;

  const allAppts: any[] = [
    ...(dashboardData.upcoming_appointments || []),
    ...(dashboardData.past_appointments || []),
  ];

  const filteredAppts = allAppts.filter((appt: any) => {
    if (appointmentFilter === 'upcoming') {
      if (!['scheduled', 'confirmed', 'in_progress', 'rescheduled'].includes(appt.status)) return false;
    } else if (appointmentFilter === 'completed') {
      if (appt.status !== 'completed') return false;
    } else if (appointmentFilter === 'cancelled') {
      if (appt.status !== 'cancelled') return false;
    }

    if (appointmentDateFilter) {
      const apptDate = appt.appointment_datetime ? appt.appointment_datetime.split('T')[0] : '';
      if (apptDate !== appointmentDateFilter) return false;
    }

    return true;
  });

  return (
    <div className="card">
      <div className="card-title-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <h3 className="card-title" style={{ margin: 0 }}><Calendar size={18} /> My Appointments</h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Filter Date:</label>
            <CustomDatePicker value={appointmentDateFilter} onChange={setAppointmentDateFilter} />
          </div>

          <button
            onClick={() => { setBookingStep(1); setScreen('book'); }}
            className="btn-primary"
            style={{ padding: '8px 14px', fontSize: '0.82rem' }}
          >
            + Book Appointment
          </button>
        </div>
      </div>

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
              return (
                <tr
                  key={appt.id}
                  style={{ cursor: 'pointer' }}
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
                  </td>
                  <td><MapPin size={13} style={{ display: 'inline', marginRight: '4px', color: '#64748b' }} />{appt.branch?.name}</td>
                  <td>{new Date(appt.appointment_datetime).toLocaleString()}</td>
                  <td>{appt.treatment_type}</td>
                  <td>{appt.consultation_type === 'in_person' ? 'In Person' : 'Video Consultation'}</td>
                  <td>
                    <span className={`status-pill ${appt.status.replace(/_/g, '-')}`}>{appt.status.replace(/[_-]/g, ' ')}</span>
                  </td>
                  <td>
                    {['confirmed', 'scheduled', 'rescheduled'].includes(appt.status) ? (
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
