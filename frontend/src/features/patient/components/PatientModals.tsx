import React from 'react';
import { UploadCloud, Clock, Download, Video } from 'lucide-react';

interface PatientModalsProps {
  // Reschedule
  rescheduleApptId: string | null;
  setRescheduleApptId: (id: string | null) => void;
  rescheduleDate: string;
  rescheduleSlot: string;
  rescheduleSlots: any[];
  handleRescheduleDateSelect: (date: string, typeParam?: string) => void;
  setRescheduleSlot: (slot: string) => void;
  handleRescheduleSubmit: () => void;
  formatTimeToAMPM: (time: string) => string;

  // Cancel
  cancelApptId: string | null;
  setCancelApptId: (id: string | null) => void;
  cancelReason: string;
  setCancelReason: (reason: string) => void;
  handleCancelSubmit: () => void;

  // Prescription Modal
  viewingPrescription: any;
  setViewingPrescription: (rx: any) => void;
  downloadPdf: (url: string, filename: string) => void;

  // Booking Confirmation Modal
  showBookingConfirm: boolean;
  setShowBookingConfirm: (show: boolean) => void;
  selectedBranchId: string;
  selectedDoctorId: string;
  branches: any[];
  doctors: any[];
  bookingDate: string;
  bookingSlot: string;
  consultationType: string;
  treatmentType: string;
  customTreatmentText: string;
  bookingNotes: string;
  isLoading: boolean;
  handleBookingSubmit: () => Promise<void>;

  // Upload Report Modal
  showUploadModal: boolean;
  setShowUploadModal: (show: boolean) => void;
  uploadTitle: string;
  setUploadTitle: (title: string) => void;
  uploadType: string;
  setUploadType: (type: string) => void;
  setUploadFile: (file: File | null) => void;
  handleReportUpload: (e: React.FormEvent) => void;

  // Viewing Report Modal
  viewingReport: any;
  setViewingReport: (report: any) => void;
  isImageFile: (url: string) => boolean;
  imageZoom: number;
  setImageZoom: React.Dispatch<React.SetStateAction<number>>;
  imageRotate: number;
  setImageRotate: React.Dispatch<React.SetStateAction<number>>;

  // Viewing Appointment Modal
  viewingAppointment: any;
  setViewingAppointment: (appt: any) => void;
  handleJoinMeeting: (id: string) => void;

  // Viewing History Event Modal
  viewingHistoryEvent: any;
  setViewingHistoryEvent: (event: any) => void;
  timeline: any[];
  dashboardData: any;
  setViewingInvoice: (invoice: any) => void;
  triggerToast: (type: 'success' | 'error', message: string) => void;

  // Viewing Invoice Modal
  viewingInvoice: any;
  patientProfile: any;

  // Conflict Modal
  conflictAppt: any;
  setConflictAppt: (appt: any) => void;
  setScreen: (screen: any) => void;
  openRescheduleModal: (apptId: string, doctorId: string, type?: string) => void;
  rescheduleConsultationType?: string;
}

export const PatientModals: React.FC<PatientModalsProps> = ({
  rescheduleApptId,
  setRescheduleApptId,
  rescheduleDate,
  rescheduleConsultationType = 'in_person',
  rescheduleSlot,
  rescheduleSlots,
  handleRescheduleDateSelect,
  setRescheduleSlot,
  handleRescheduleSubmit,
  formatTimeToAMPM,

  cancelApptId,
  setCancelApptId,
  cancelReason,
  setCancelReason,
  handleCancelSubmit,

  viewingPrescription,
  setViewingPrescription,
  downloadPdf,

  showBookingConfirm,
  setShowBookingConfirm,
  selectedBranchId,
  selectedDoctorId,
  branches,
  doctors,
  bookingDate,
  bookingSlot,
  consultationType,
  treatmentType,
  customTreatmentText,
  bookingNotes,
  isLoading,
  handleBookingSubmit,

  showUploadModal,
  setShowUploadModal,
  uploadTitle,
  setUploadTitle,
  uploadType,
  setUploadType,
  setUploadFile,
  handleReportUpload,

  viewingReport,
  setViewingReport,
  isImageFile,
  imageZoom,
  setImageZoom,
  imageRotate,
  setImageRotate,

  viewingAppointment,
  setViewingAppointment,
  handleJoinMeeting,

  viewingHistoryEvent,
  setViewingHistoryEvent,
  timeline,
  dashboardData,
  setViewingInvoice,
  triggerToast,

  viewingInvoice,
  patientProfile: _patientProfile,

  conflictAppt,
  setConflictAppt,
  setScreen,
  openRescheduleModal,
}) => {
  return (
    <>
      {/* ── MODAL: RESCHEDULE APPOINTMENT ── */}
      {rescheduleApptId && (
        <div className="modal-overlay">
          <div className="modal-card">
            <header className="modal-header">
              <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)' }}>
                Reschedule {rescheduleConsultationType === 'teleconsultation' ? 'Teleconsultation' : 'In-Clinic'} Appointment
              </h3>
              <button onClick={() => setRescheduleApptId(null)} style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>&times;</button>
            </header>

            <div className="modal-body">
              <div style={{
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                color: '#d97706',
                border: '1px solid #fef3c7',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                marginBottom: '12px'
              }}>
                Warning: Appointments cannot be rescheduled within 2 hours of the scheduled time. Limit: 2 reschedule attempts maximum.
              </div>

              {rescheduleConsultationType === 'teleconsultation' ? (
                <div style={{
                  backgroundColor: '#f0f9ff',
                  color: '#0369a1',
                  border: '1px solid #bae6fd',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: '16px'
                }}>
                  📹 Teleconsultation slots are exclusively available from 3:00 PM to 5:00 PM.
                </div>
              ) : (
                <div style={{
                  backgroundColor: '#f8fafc',
                  color: '#475569',
                  border: '1px solid #e2e8f0',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: '16px'
                }}>
                  🏥 In-person consultation slots exclude the 3:00 PM – 5:00 PM teleconsultation window.
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Consultation Mode</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (rescheduleConsultationType !== 'in_person') {
                        handleRescheduleDateSelect(rescheduleDate, 'in_person');
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: rescheduleConsultationType === 'in_person' ? '2px solid #0d9488' : '1px solid #cbd5e1',
                      background: rescheduleConsultationType === 'in_person' ? '#f0fdf4' : '#ffffff',
                      color: rescheduleConsultationType === 'in_person' ? '#0f766e' : '#475569',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    🏥 In-Clinic Visit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (rescheduleConsultationType !== 'teleconsultation') {
                        handleRescheduleDateSelect(rescheduleDate, 'teleconsultation');
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: rescheduleConsultationType === 'teleconsultation' ? '2px solid #0284c7' : '1px solid #cbd5e1',
                      background: rescheduleConsultationType === 'teleconsultation' ? '#f0f9ff' : '#ffffff',
                      color: rescheduleConsultationType === 'teleconsultation' ? '#0369a1' : '#475569',
                      fontWeight: 600,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                  >
                    📹 Teleconsultation (3-5 PM)
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">New Date</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => handleRescheduleDateSelect(e.target.value)}
                  className="form-input"
                />
              </div>

              {rescheduleDate && (() => {
                const safeRescheduleSlots = Array.isArray(rescheduleSlots)
                  ? rescheduleSlots
                  : (Array.isArray((rescheduleSlots as any)?.data?.items)
                    ? (rescheduleSlots as any).data.items
                    : (Array.isArray((rescheduleSlots as any)?.data)
                      ? (rescheduleSlots as any).data
                      : []));

                return (
                  <div style={{ marginTop: '16px' }}>
                    <label className="form-label">Select Available Slot</label>
                    <div className="slots-grid">
                      {safeRescheduleSlots.map((slot: any) => {
                        const slotTime = typeof slot === 'string' ? slot : (slot?.time || slot?.start_time || slot?.slot_time || '');
                        const slotStatus = typeof slot === 'string' ? 'available' : (slot?.status || (slot?.is_active === false ? 'booked' : 'available'));
                        const isBooked = slotStatus === 'booked';
                        const isSelected = rescheduleSlot === slotTime;
                        return (
                          <button
                            key={slotTime || Math.random()}
                            className={`slot-button${isSelected ? ' selected' : ''}${isBooked ? ' booked' : ''}`}
                            onClick={() => !isBooked && slotTime && setRescheduleSlot(slotTime)}
                            disabled={isBooked || !slotTime}
                            title={isBooked ? 'Already booked' : `Select ${formatTimeToAMPM(slotTime)}`}
                          >
                            {formatTimeToAMPM(slotTime)}
                          </button>
                        );
                      })}
                      {safeRescheduleSlots.length === 0 && (
                        <p style={{ gridColumn: 'span 3', color: 'var(--text-muted)', textAlign: 'center', fontSize: '0.85rem' }}>
                          No slots available on this date.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            <footer className="modal-footer">
              <button onClick={() => setRescheduleApptId(null)} className="btn-secondary">Cancel</button>
              <button
                onClick={handleRescheduleSubmit}
                className="btn-primary"
                disabled={!rescheduleDate || !rescheduleSlot || isLoading}
              >
                {isLoading ? 'Updating...' : 'Save Changes'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ── MODAL: CANCEL APPOINTMENT ── */}
      {cancelApptId && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '480px' }}>
            <header className="modal-header">
              <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)' }}>Cancel Appointment</h3>
              <button onClick={() => setCancelApptId(null)} style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>&times;</button>
            </header>

            <div className="modal-body">
              <p style={{ fontSize: '0.9rem', marginBottom: '14px' }}>Are you sure you want to cancel this appointment? Cancellation is not allowed within 2 hours of the scheduled time.</p>

              <div className="form-group">
                <label className="form-label">Reason for Cancellation</label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Schedule conflict, feeling better"
                  className="form-input"
                />
              </div>
            </div>

            <footer className="modal-footer">
              <button onClick={() => setCancelApptId(null)} className="btn-secondary">Close</button>
              <button onClick={handleCancelSubmit} className="btn-primary" style={{ backgroundColor: 'var(--error-red)', borderColor: 'var(--error-red)' }} disabled={isLoading}>
                {isLoading ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ── MODAL: PRESCRIPTION DETAIL ── */}
      {viewingPrescription && (() => {
        const { rx, diagnosis, symptoms } = viewingPrescription;
        const doctorName = rx.doctor?.user?.full_name
          ? (rx.doctor.user.full_name.toLowerCase().startsWith('dr') ? rx.doctor.user.full_name : `Dr. ${rx.doctor.user.full_name}`)
          : 'Doctor';
        const medicines = rx.items || rx.medications || [];
        const consultationNotes = rx.consultation?.notes || '';
        const notes = consultationNotes || rx.notes || '';
        const prescribedDate = new Date(rx.created_at).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        return (
          <div className="modal-overlay" style={{ zIndex: 9999 }} onClick={() => setViewingPrescription(null)}>
            <div
              className="modal-card"
              style={{ maxWidth: '580px', borderRadius: '18px', overflow: 'hidden', padding: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{
                background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%)',
                padding: '16px 28px 10px', color: '#fff', position: 'relative'
              }}>
                <div style={{ fontSize: '1.8rem', marginBottom: '6px' }}>💊</div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Prescription Details</h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.8rem', opacity: 0.85 }}>
                  Issued by {doctorName} &nbsp;·&nbsp; {prescribedDate}
                </p>
                <button
                  onClick={() => setViewingPrescription(null)}
                  style={{
                    position: 'absolute', top: '14px', right: '16px',
                    background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff',
                    fontSize: '1rem', cursor: 'pointer', borderRadius: '50%',
                    width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >&times;</button>
              </div>

              <div style={{ padding: '22px 28px', maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: '6px' }}>🩺 Diagnosis</div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>{diagnosis}</div>
                  </div>
                  <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: '6px' }}>🤒 Symptoms</div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--ink)', lineHeight: 1.4 }}>{symptoms}</div>
                  </div>
                </div>

                {notes && (
                  <div style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: '10px', padding: '14px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--primary-dark)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: '6px' }}>📝 Doctor's Notes</div>
                    <div style={{ fontSize: '0.88rem', color: 'var(--ink)', lineHeight: 1.6 }}>{notes}</div>
                  </div>
                )}

                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700, marginBottom: '10px' }}>
                    💊 Prescribed Medicines ({medicines.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {medicines.map((med: any, idx: number) => (
                      <div key={idx} style={{
                        background: 'var(--surface-2)', border: '1px solid var(--border)',
                        borderRadius: '12px', padding: '14px 16px',
                        display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', alignItems: 'start'
                      }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary-dark)', marginBottom: '4px' }}>
                            {med.medicine_name || med.name}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                            {med.dosage && (
                              <span style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)', fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: '20px' }}>
                                📋 {med.dosage}
                              </span>
                            )}
                            {(med.duration || med.duration_days) && (
                              <span style={{ background: '#f0fdf4', color: '#16a34a', fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', border: '1px solid #bbf7d0' }}>
                                📅 {med.duration || med.duration_days + ' Days'}
                              </span>
                            )}
                            {med.instructions && (
                              <span style={{ background: '#fff7ed', color: '#c2410c', fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', border: '1px solid #fed7aa' }}>
                                ⚠️ {med.instructions}
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <span style={{
                            fontSize: '0.72rem', fontWeight: 700, padding: '4px 10px', borderRadius: '20px',
                            background: idx % 2 === 0 ? 'var(--primary-light)' : '#f0fdf4',
                            color: idx % 2 === 0 ? 'var(--primary)' : '#16a34a'
                          }}>
                            #{idx + 1}
                          </span>
                        </div>
                      </div>
                    ))}
                    {medicines.length === 0 && (
                      <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '16px' }}>
                        No medications listed on this prescription.
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    RX ID: {rx.id?.toUpperCase()}
                  </div>
                  <span className={`status-pill ${rx.status === 'active' || rx.status === 'dispensed' ? 'completed' : 'pending'}`}>
                    {rx.status}
                  </span>
                </div>
              </div>

              <div style={{ padding: '14px 28px 20px', display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setViewingPrescription(null)} className="btn-secondary">Close</button>
                <button
                  onClick={() => { setViewingPrescription(null); downloadPdf(`/prescriptions/${rx.id}/pdf`, `Prescription_${rx.id.substring(0, 8)}.pdf`); }}
                  className="btn-primary"
                  style={{ gap: '6px' }}
                >
                  <Download size={14} /> Download PDF
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── MODAL: BOOKING CONFIRMATION ── */}
      {showBookingConfirm && (() => {
        const selectedBranch = (Array.isArray(branches) ? branches : []).find((b: any) => b.id === selectedBranchId);
        const selectedDoctor = (Array.isArray(doctors) ? doctors : []).find((d: any) => d.id === selectedDoctorId);
        const doctorName = selectedDoctor?.user?.full_name
          ? (selectedDoctor.user.full_name.toLowerCase().startsWith('dr')
            ? selectedDoctor.user.full_name
            : `Dr. ${selectedDoctor.user.full_name}`)
          : 'Selected Doctor';
        return (
          <div className="modal-overlay" style={{ zIndex: 9999, overflowY: 'auto' }}>
            <div className="modal-card" style={{ maxWidth: '520px', borderRadius: '18px', overflow: 'hidden', padding: 0, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{
                background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%)',
                padding: '24px 28px 20px',
                color: '#fff',
                position: 'relative',
                flexShrink: 0
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📋</div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Confirm Your Appointment</h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', opacity: 0.85 }}>Please review the details before confirming</p>
                <button
                  onClick={() => setShowBookingConfirm(false)}
                  style={{
                    position: 'absolute', top: '16px', right: '18px',
                    background: 'rgba(255,255,255,0.15)', border: 'none',
                    color: '#fff', fontSize: '1.1rem', cursor: 'pointer',
                    borderRadius: '50%', width: '30px', height: '30px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1
                  }}
                >&times;</button>
              </div>

              <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flex: 1 }}>
                {[
                  { icon: '🏥', label: 'Branch', value: selectedBranch ? `${selectedBranch.name} Branch` : '—' },
                  { icon: '👨‍⚕️', label: 'Doctor', value: doctorName },
                  { icon: '📅', label: 'Date', value: bookingDate ? new Date(bookingDate + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '—' },
                  { icon: '🕐', label: 'Time Slot', value: bookingSlot || '—' },
                  { icon: consultationType === 'teleconsultation' ? '💻' : '🏥', label: 'Mode', value: consultationType === 'teleconsultation' ? 'Tele Consultation (Video Call)' : 'In Clinic Visit' },
                  { icon: '🦷', label: 'Treatment Type', value: treatmentType === 'Other (Custom Concern)' ? (customTreatmentText || 'Other') : (treatmentType || 'General Checkup') },
                ].map(({ icon, label, value }) => (
                  <div key={label} style={{
                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                    padding: '10px 14px', borderRadius: '10px',
                    background: 'var(--surface-2)', border: '1px solid var(--border)'
                  }}>
                    <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{label}</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--ink)', marginTop: '2px' }}>{value}</div>
                    </div>
                  </div>
                ))}
                {bookingNotes.trim() && (
                  <div style={{
                    padding: '10px 14px', borderRadius: '10px',
                    background: 'var(--surface-2)', border: '1px solid var(--border)'
                  }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '4px' }}>📝 Notes for Doctor</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--ink)', lineHeight: 1.5 }}>{bookingNotes}</div>
                  </div>
                )}

                <div style={{
                  background: 'rgba(14,165,233,0.07)', border: '1px solid rgba(14,165,233,0.2)',
                  borderRadius: '8px', padding: '10px 14px', fontSize: '0.78rem',
                  color: 'var(--primary-dark)', lineHeight: 1.5
                }}>
                  ℹ️ Once confirmed, you'll receive a notification. You can reschedule or cancel anytime from the Upcoming Appointments section.
                </div>
              </div>

              <div style={{
                padding: '16px 28px 24px',
                display: 'flex', gap: '12px', justifyContent: 'flex-end',
                borderTop: '1px solid var(--border)',
                flexShrink: 0,
                background: '#ffffff'
              }}>
                <button
                  onClick={() => setShowBookingConfirm(false)}
                  className="btn-secondary"
                  disabled={isLoading}
                >
                  ← Go Back
                </button>
                <button
                  onClick={async () => {
                    setShowBookingConfirm(false);
                    await handleBookingSubmit();
                  }}
                  className="btn-primary"
                  disabled={isLoading}
                  style={{ minWidth: '150px', justifyContent: 'center' }}
                >
                  {isLoading ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)',
                        borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite'
                      }} />
                      Booking...
                    </span>
                  ) : '✓ Confirm & Book'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── MODAL: UPLOAD MEDICAL REPORT ── */}
      {showUploadModal && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '500px' }}>
            <header className="modal-header">
              <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)' }}>Upload Diagnostics Report</h3>
              <button onClick={() => setShowUploadModal(false)} style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>&times;</button>
            </header>

            <form onSubmit={handleReportUpload}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Report Title</label>
                  <input
                    type="text"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="e.g. Dental OPG X-Ray, Blood Test"
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Report Category</label>
                  <select
                    value={uploadType}
                    onChange={(e) => setUploadType(e.target.value)}
                    className="form-input"
                  >
                    <option value="Lab Report">Lab Report</option>
                    <option value="X-Ray Scan">X-Ray Scan</option>
                    <option value="Prescription PDF">Prescription PDF</option>
                    <option value="Consent Form">Consent Form</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Select Report File</label>
                  <div className="upload-dropzone">
                    <UploadCloud size={32} style={{ color: 'var(--primary-teal)' }} />
                    <input
                      type="file"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      required
                      style={{ fontSize: '0.85rem' }}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>PDF, PNG, JPG scans are accepted. Max: 10MB</span>
                  </div>
                </div>
              </div>

              <footer className="modal-footer">
                <button type="button" onClick={() => setShowUploadModal(false)} className="btn-secondary">Cancel</button>
                <button type="submit" className="btn-primary" disabled={isLoading}>
                  {isLoading ? 'Uploading...' : 'Upload File'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: VIEW REPORT ── */}
      {viewingReport && (() => {
        const fileUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${viewingReport.file_url}`;
        const isImage = isImageFile(viewingReport.file_url);

        return (
          <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <div className="modal-card" style={{ maxWidth: '800px', width: '90%' }}>
              <header className="modal-header">
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)' }}>{viewingReport.title}</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Category: {viewingReport.report_type}</span>
                </div>
                <button onClick={() => setViewingReport(null)} style={{ fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
              </header>

              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
                {isImage ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', background: 'var(--surface-2)', padding: '6px', borderRadius: '8px' }}>
                      <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => setImageZoom(prev => Math.max(0.5, prev - 0.25))}>Zoom Out (-)</button>
                      <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => setImageZoom(1)}>Reset</button>
                      <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => setImageZoom(prev => Math.min(3, prev + 0.25))}>{Math.round(imageZoom * 100)}%</button>
                      <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => setImageRotate(prev => (prev + 90) % 360)}>Rotate ↻</button>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '450px',
                      background: '#0f172a',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'auto',
                      position: 'relative'
                    }}>
                      <img
                        src={fileUrl}
                        alt={viewingReport.title}
                        style={{
                          maxHeight: '100%',
                          maxWidth: '100%',
                          objectFit: 'contain',
                          transform: `scale(${imageZoom}) rotate(${imageRotate}deg)`,
                          transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                      />
                    </div>
                  </div>
                ) : viewingReport.file_url?.toLowerCase().endsWith('.pdf') ? (
                  <div style={{ width: '100%', height: '500px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <iframe
                      src={fileUrl}
                      style={{ width: '100%', height: '100%', border: 'none' }}
                      title={viewingReport.title}
                    />
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--surface-2)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '3rem', display: 'block', marginBottom: '12px' }}>📁</span>
                    <p style={{ margin: '0 0 16px', fontWeight: 600 }}>Preview not available for this file type</p>
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-primary"
                      style={{ display: 'inline-block', textDecoration: 'none', fontSize: '0.85rem' }}
                    >
                      Open in New Tab / Download
                    </a>
                  </div>
                )}
              </div>

              <footer className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)', padding: '12px 20px' }}>
                <a
                  href={fileUrl}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary"
                  style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
                >
                  Download File
                </a>
                <button onClick={() => setViewingReport(null)} className="btn-primary" style={{ fontSize: '0.85rem' }}>
                  Close
                </button>
              </footer>
            </div>
          </div>
        );
      })()}

      {/* ── MODAL: VIEW APPOINTMENT DETAILS ── */}
      {viewingAppointment && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-card" style={{ maxWidth: '600px', width: '95%' }}>
            <header className="modal-header">
              <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)' }}>Appointment Details</h3>
              <button onClick={() => setViewingAppointment(null)} style={{ fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
            </header>
            <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Doctor</label>
                  <p style={{ margin: '4px 0 0', fontWeight: 600 }}>
                    {viewingAppointment.doctor_name || (viewingAppointment.doctor?.user?.full_name?.toLowerCase().startsWith('dr') ? viewingAppointment.doctor?.user?.full_name : `Dr. ${viewingAppointment.doctor?.user?.full_name}`)}
                  </p>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Branch</label>
                  <p style={{ margin: '4px 0 0' }}>{viewingAppointment.branch?.name || 'Main Branch'}</p>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Date &amp; Time</label>
                  <p style={{ margin: '4px 0 0' }}>{new Date(viewingAppointment.appointment_datetime).toLocaleString()}</p>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Status</label>
                  <p style={{ margin: '4px 0 0' }}>
                    <span className={`status-pill ${viewingAppointment.status}`}>{viewingAppointment.status}</span>
                  </p>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Type</label>
                  <p style={{ margin: '4px 0 0' }}>
                    <span className={`badge ${viewingAppointment.consultation_type === 'teleconsultation' ? 'badge-tele' : 'badge-clinic'}`} style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      background: viewingAppointment.consultation_type === 'teleconsultation' ? 'var(--primary-light)' : '#f1f5f9',
                      color: viewingAppointment.consultation_type === 'teleconsultation' ? 'var(--primary)' : '#475569'
                    }}>
                      {viewingAppointment.consultation_type === 'teleconsultation' ? '💻 Tele Consultation' : '🏥 In Clinic'}
                    </span>
                  </p>
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Treatment Concern</label>
                  <p style={{ margin: '4px 0 0' }}>{viewingAppointment.treatment_type || 'General Checkup'}</p>
                </div>
              </div>

              {viewingAppointment.notes && (
                <div style={{ marginTop: '8px', padding: '12px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Consultation Notes / Symptoms</label>
                  <p style={{ margin: 0, fontSize: '0.88rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{viewingAppointment.notes}</p>
                </div>
              )}

              {viewingAppointment.consultation_type === 'teleconsultation' && viewingAppointment.status === 'confirmed' && (
                <div style={{ marginTop: '8px', padding: '12px', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>💻 Video Consultation is ready to join!</p>
                  <button
                    onClick={() => {
                      setViewingAppointment(null);
                      handleJoinMeeting(viewingAppointment.id);
                    }}
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <Video size={16} /> Join Video Consultation
                  </button>
                </div>
              )}
            </div>
            <footer className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', padding: '12px 20px' }}>
              <button onClick={() => setViewingAppointment(null)} className="btn-primary" style={{ fontSize: '0.85rem' }}>Close</button>
            </footer>
          </div>
        </div>
      )}

      {/* ── MODAL: VIEW HISTORY VISIT DETAILS ── */}
      {viewingHistoryEvent && (() => {
        const eventDate = new Date(viewingHistoryEvent.datetime).toDateString();
        const rxMatch = timeline.find(event =>
          event.event_type === 'prescription' &&
          new Date(event.datetime).toDateString() === eventDate
        );
        const billMatch = timeline.find(event =>
          event.event_type === 'invoice' &&
          new Date(event.datetime).toDateString() === eventDate
        );

        return (
          <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <div className="modal-card" style={{ maxWidth: '650px', width: '95%' }}>
              <header className="modal-header">
                <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)' }}>Medical History Visit Details</h3>
                <button onClick={() => setViewingHistoryEvent(null)} style={{ fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
              </header>
              <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Doctor</label>
                    <p style={{ margin: '4px 0 0', fontWeight: 600 }}>{viewingHistoryEvent.title}</p>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Visit Date</label>
                    <p style={{ margin: '4px 0 0' }}>{new Date(viewingHistoryEvent.datetime).toLocaleString()}</p>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Diagnosis / Medical Summary</label>
                  <div style={{ padding: '12px', background: 'var(--surface-2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)' }}>
                      {viewingHistoryEvent.details?.diagnosis || viewingHistoryEvent.description || 'No diagnosis recorded.'}
                    </p>
                  </div>
                </div>

                {viewingHistoryEvent.details?.symptoms && (
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Recorded Symptoms</label>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink)' }}>{viewingHistoryEvent.details.symptoms}</p>
                  </div>
                )}

                {viewingHistoryEvent.details?.notes && (
                  <div>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Clinical Instructions &amp; Recommendations</label>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--muted)', fontStyle: 'italic', lineHeight: 1.5 }}>
                      "{viewingHistoryEvent.details.notes}"
                    </p>
                  </div>
                )}

                {rxMatch && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '8px' }}>💊 Prescribed Medications</label>
                    <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <p style={{ margin: '0 0 8px', fontSize: '0.82rem', color: 'var(--muted)' }}>
                        Prescription Code: {(rxMatch.details?.prescription_id || rxMatch.id)?.substring(0, 8).toUpperCase()}
                      </p>
                      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.88rem' }}>
                        {(rxMatch.details?.medicines || rxMatch.details?.medications || rxMatch.details?.items)?.map((med: any, idx: number) => (
                          <li key={idx} style={{ marginBottom: '4px' }}>
                            <strong>{med.name || med.medicine_name}</strong> - {med.dosage} ({med.duration || `${med.duration_days} Days`})
                            {med.instructions && <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Instructions: {med.instructions}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {billMatch && (
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '8px' }}>💳 Associated Billing Invoice</label>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600 }}>{billMatch.title}</p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--muted)' }}>Amount: {billMatch.description}</p>
                      </div>
                      <button
                        onClick={() => {
                          const fullBill = dashboardData?.bills?.find((b: any) => b.id === billMatch.id);
                          if (fullBill) {
                            setViewingInvoice(fullBill);
                          } else {
                            triggerToast('error', 'Invoice details not loaded.');
                          }
                        }}
                        className="btn-secondary"
                        style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                      >
                        View Full Invoice
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <footer className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border)', padding: '12px 20px' }}>
                <button onClick={() => setViewingHistoryEvent(null)} className="btn-primary" style={{ fontSize: '0.85rem' }}>Close</button>
              </footer>
            </div>
          </div>
        );
      })()}

      {/* ── MODAL: VIEW INVOICE DETAILS ── */}
      {viewingInvoice && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-card" style={{ maxWidth: '600px', width: '95%' }}>
            <header className="modal-header">
              <h3 style={{ margin: 0, fontFamily: 'var(--font-heading)' }}>Invoice &amp; Statement</h3>
              <button onClick={() => setViewingInvoice(null)} style={{ fontSize: '1.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>&times;</button>
            </header>
            <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--primary)' }}>INV-{viewingInvoice.invoice_number}</h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Issued: {new Date(viewingInvoice.created_at || viewingInvoice.due_date).toLocaleDateString()}</span>
                </div>
                <span className={`status-pill ${viewingInvoice.status}`}>{viewingInvoice.status}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05rem', fontWeight: 700 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Consultation Fee:</span>
                  <span style={{ color: 'var(--primary)' }}>₹{viewingInvoice.total_amount}</span>
                </div>
              </div>
            </div>
            <footer className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)', padding: '12px 20px' }}>
              <button
                onClick={() => downloadPdf(`/billing/${viewingInvoice.id}/pdf`, `Invoice_${viewingInvoice.invoice_number}.pdf`)}
                className="btn-secondary"
                style={{ fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Download size={14} /> Download PDF Invoice
              </button>
              <button onClick={() => setViewingInvoice(null)} className="btn-primary" style={{ fontSize: '0.85rem' }}>Close</button>
            </footer>
          </div>
        </div>
      )}

      {/* ── MODAL: BOOKING CONFLICT DETECTED ── */}
      {conflictAppt && (
        <div className="modal-overlay" style={{ zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', backgroundColor: 'rgba(15, 23, 42, 0.6)' }}>
          <div className="modal-card" style={{ maxWidth: '500px', width: '90%', borderRadius: '16px', border: '1px solid rgba(226, 232, 240, 0.8)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', padding: '24px', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#fee2e2', color: '#ef4444', flexShrink: 0 }}>
                <Clock size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', fontFamily: 'var(--font-heading)' }}>Booking Conflict Detected</h3>
                <p style={{ margin: '8px 0 0', fontSize: '0.9rem', color: '#475569', lineHeight: 1.5 }}>
                  You already have an active appointment scheduled on <strong>{bookingDate}</strong> with <strong>{conflictAppt.doctor?.user?.full_name || 'this doctor'}</strong>.
                </p>
                <p style={{ margin: '8px 0 0', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.5 }}>
                  Under clinic guidelines, patients can only book one active appointment per doctor per day. You can reschedule your existing appointment to a different time instead.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button
                onClick={() => setConflictAppt(null)}
                className="btn-secondary"
                style={{ padding: '10px 18px', fontSize: '0.875rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}
              >
                Cancel &amp; Close
              </button>
              <button
                onClick={() => {
                  const id = conflictAppt.id;
                  const docId = conflictAppt.doctor_id;
                  const cType = conflictAppt.consultation_type || consultationType || 'in_person';
                  setConflictAppt(null);
                  setScreen('dashboard');
                  openRescheduleModal(id, docId, cType);
                }}
                className="btn-primary"
                style={{ padding: '10px 18px', fontSize: '0.875rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                <Clock size={16} /> Reschedule Existing
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
