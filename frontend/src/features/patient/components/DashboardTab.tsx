import React from 'react';
import { Calendar, Pill, CreditCard, Check, ChevronRight, Clock, X } from 'lucide-react';

interface DashboardTabProps {
  patientProfile: any;
  dashboardData: any;
  statistics: any;
  setScreen: (screen: any) => void;
  openBookingWizard?: () => void;
  openRescheduleModal: (apptId: string, doctorId: string, type?: string) => void;
  setCancelApptId: (id: string | null) => void;
  setViewingAppointment: (appt: any) => void;
  triggerToast: (type: 'success' | 'error' | 'info', message: string) => void;
  followups?: any[];
  handleBookFollowup?: (followup: any) => void;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  patientProfile,
  dashboardData,
  statistics,
  setScreen,
  openBookingWizard,
  openRescheduleModal,
  setCancelApptId,
  setViewingAppointment,
  triggerToast,
  followups = [],
  handleBookFollowup,
}) => {
  const activeFollowups = followups.filter((f: any) => f.status === 'recommended');

  if (!dashboardData) return null;

  return (
    <div className="dashboard-grid">
      {/* Follow-up Recommendation Alert */}
      {activeFollowups.length > 0 && (
        <div style={{
          gridColumn: '1 / -1',
          background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.15) 0%, rgba(59, 130, 246, 0.1) 100%)',
          backdropFilter: 'blur(10px)',
          border: '1.5px solid rgba(20, 184, 166, 0.3)',
          borderRadius: '16px',
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(20, 184, 166, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.4rem'
            }}>
              🩺
            </div>
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                Follow-up Suggested by {activeFollowups[0].doctor_name}
              </h4>
              <p style={{ margin: 0, fontSize: '0.86rem', color: '#475569', lineHeight: '1.4' }}>
                {activeFollowups[0].treatment_type} advised. Recommended Date: <strong>{new Date(activeFollowups[0].recommended_date).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={() => handleBookFollowup?.(activeFollowups[0])}
            style={{
              padding: '12px 20px',
              backgroundColor: 'var(--primary-teal, #14b8a6)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '10px',
              fontWeight: 700,
              fontSize: '0.88rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(20, 184, 166, 0.25)',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            Book Follow-up Now <ChevronRight size={16} />
          </button>
        </div>
      )}
      {/* Hero Banner Card */}
      {patientProfile && (
        <div className="hero-banner">
          <div className="hero-text">
            <span className="hero-welcome">Welcome back,</span>
            <h2 className="hero-name">{patientProfile.user?.full_name}</h2>
            <span className="hero-meta">
              Patient ID: {patientProfile.patient_code} {patientProfile.preferred_branch?.name ? `· ${patientProfile.preferred_branch.name}` : ''}
            </span>
          </div>
          <div className="hero-actions">
            <button
              onClick={() => {
                const firstAppt = dashboardData.upcoming_appointments?.[0];
                if (firstAppt) {
                  const isLimitReached = (firstAppt.reschedule_count || 0) >= 2;
                  const apptTime = new Date(firstAppt.appointment_datetime).getTime();
                  const isWithinTwoHours = apptTime - Date.now() < 2 * 60 * 60 * 1000;

                  if (isLimitReached) {
                    triggerToast('error', 'Maximum reschedule limit reached. Please contact receptionist to update your appointment.');
                    return;
                  }
                  if (isWithinTwoHours) {
                    triggerToast('error', 'Rescheduling is not allowed within 2 hours of the scheduled time. Please call the clinic.');
                    return;
                  }
                  openRescheduleModal(firstAppt.id, firstAppt.doctor_id, firstAppt.consultation_type);
                } else {
                  triggerToast('error', 'No active appointments to reschedule. Please book a new one.');
                }
              }}
              className="btn-hero-secondary"
            >
              <Clock size={16} /> Reschedule
            </button>
            <button onClick={openBookingWizard} className="btn-hero-primary">
              <Calendar size={16} /> Book an Appointment
            </button>
          </div>
        </div>
      )}

      {/* Metrics cards */}
      {statistics && (
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-info">
              <span className="stat-val">{dashboardData.upcoming_appointments?.length || 0}</span>
              <span className="stat-label">Upcoming Appointments</span>
            </div>
            <div className="stat-icon-wrapper accent-teal">
              <Calendar size={20} />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-info">
              <span className="stat-val">{statistics.active_prescriptions || 0}</span>
              <span className="stat-label">Active Prescriptions</span>
            </div>
            <div className="stat-icon-wrapper accent-green">
              <Pill size={20} />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-info">
              <span className="stat-val">₹{statistics.balance_due || 0}</span>
              <span className="stat-label">Balance Due</span>
            </div>
            <div className="stat-icon-wrapper accent-yellow">
              <CreditCard size={20} />
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-info">
              <span className="stat-val">{statistics.total_visits ?? 0}</span>
              <span className="stat-label">Visits This Year</span>
            </div>
            <div className="stat-icon-wrapper accent-blue">
              <Check size={20} />
            </div>
          </div>
        </div>
      )}

      {/* Two columns main content */}
      <div className="portal-layout-columns">
        {/* Left column */}
        <div className="col">
          {/* Upcoming Appointment Widget */}
          <div className="card">
            <div className="card-title-bar">
              <h3 className="card-title"><Calendar size={18} /> Upcoming Appointments</h3>
              <span
                onClick={() => setScreen('appointments')}
                style={{ fontSize: '0.78rem', color: 'var(--primary-teal)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}
              >
                View all <ChevronRight size={13} />
              </span>
            </div>
            <div className="dash-appt-list">
              {dashboardData.upcoming_appointments && dashboardData.upcoming_appointments.length > 0 ? (
                dashboardData.upcoming_appointments.map((appt: any) => (
                  <div
                    key={appt.id}
                    className="dash-appt-item"
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.tagName.toLowerCase() === 'button' || target.closest('button')) {
                        return;
                      }
                      setViewingAppointment(appt);
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="dash-doctor-avatar">Dr</div>
                      <div className="dash-appt-details">
                        <span className="dash-doctor-name">
                          {appt.doctor?.user?.full_name?.toLowerCase().startsWith('dr') ? appt.doctor?.user?.full_name : `Dr. ${appt.doctor?.user?.full_name}`}
                        </span>
                        <span className="dash-appt-type">{appt.treatment_type} {appt.branch?.name ? `· ${appt.branch.name}` : ''}</span>
                        <span className="dash-appt-time">{new Date(appt.appointment_datetime).toLocaleString()}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      <span className={`status-pill ${appt.status}`}>{appt.status}</span>
                      {['confirmed', 'rescheduled'].includes(appt.status) && (() => {
                        const isLimitReached = (appt.reschedule_count || 0) >= 2;
                        const apptTime = new Date(appt.appointment_datetime).getTime();
                        const isWithinTwoHours = apptTime - Date.now() < 2 * 60 * 60 * 1000;

                        return (
                          <div className="action-buttons" style={{ marginTop: '4px' }}>
                            <button
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
                              }}
                              className="action-btn reschedule"
                              style={{ padding: '4px 8px', fontSize: '0.7rem', opacity: isLimitReached || isWithinTwoHours ? 0.5 : 1, cursor: isLimitReached || isWithinTwoHours ? 'not-allowed' : 'pointer' }}
                            >
                              <Clock size={11} /> Reschedule
                            </button>
                            <button
                              onClick={() => {
                                if (isWithinTwoHours) {
                                  triggerToast('error', 'Cancellation is not allowed within 2 hours of the scheduled time. Please call the clinic.');
                                  return;
                                }
                                setCancelApptId(appt.id);
                              }}
                              className="action-btn cancel"
                              style={{ padding: '4px 8px', fontSize: '0.7rem', opacity: isWithinTwoHours ? 0.5 : 1, cursor: isWithinTwoHours ? 'not-allowed' : 'pointer' }}
                            >
                              <X size={11} /> Cancel
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  No upcoming appointments scheduled.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column (Widgets) */}
        <div className="col">
          {/* Recent Prescriptions Widget */}
          <div className="card">
            <div className="card-title-bar">
              <h3 className="card-title"><Pill size={18} /> Recent Prescriptions</h3>
            </div>
            <div className="dash-rx-list">
              {dashboardData.prescriptions && dashboardData.prescriptions.length > 0 ? (
                dashboardData.prescriptions.slice(0, 3).map((rx: any) => (
                  <div key={rx.id} className="dash-rx-item">
                    <div className="dash-rx-info">
                      <span className="dash-rx-code">RX-{rx.id.substring(0, 5).toUpperCase()}</span>
                      <span className="dash-rx-doctor">
                        {rx.doctor?.user?.full_name?.toLowerCase().startsWith('dr') ? rx.doctor?.user?.full_name : `Dr. ${rx.doctor?.user?.full_name}`} — {new Date(rx.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="dash-rx-badge">{(rx.items || rx.medications)?.length || 0} items</span>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  No recent prescriptions found.
                </div>
              )}
              <button
                onClick={() => setScreen('prescriptions')}
                className="btn-secondary"
                style={{ width: '100%', marginTop: '12px', padding: '10px', fontSize: '0.85rem', fontWeight: 600 }}
              >
                View All Prescriptions
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
