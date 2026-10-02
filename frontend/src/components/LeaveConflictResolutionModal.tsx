import React, { useState, useEffect } from 'react';
import { 
  X, 
  AlertTriangle, 
  UserCheck, 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  ShieldAlert,
  Loader2,
  Sparkles
} from 'lucide-react';

export interface ConflictItem {
  id: string; // appointment_id
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  appointment_datetime: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  treatment_type: string;
  consultation_type: string;
  status: string;
}

export interface DoctorOption {
  id: string;
  name: string;
  specialization: string;
  department: string;
}

export interface LeaveRequestDetails {
  id: string;
  doctor_name: string;
  request_type: string;
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  reason?: string;
}

interface LeaveConflictResolutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: LeaveRequestDetails | null;
  conflicts: ConflictItem[];
  availableDoctors: DoctorOption[];
  onConfirm: (resolutions: any[]) => Promise<void>;
}

interface SingleResolutionState {
  action: 'reassign' | 'cancel';
  newDoctorId: string;
  cancelReason: string;
}

export const LeaveConflictResolutionModal: React.FC<LeaveConflictResolutionModalProps> = ({
  isOpen,
  onClose,
  request,
  conflicts,
  availableDoctors,
  onConfirm,
}) => {
  const [resolutions, setResolutions] = useState<Record<string, SingleResolutionState>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const formatTime12h = (timeStr?: string) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    const h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    if (isNaN(h)) return timeStr;
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m} ${period}`;
  };

  // Initialize resolution state for each conflict when modal opens
  useEffect(() => {
    if (!isOpen || !conflicts || conflicts.length === 0) return;

    const initialMap: Record<string, SingleResolutionState> = {};
    const defaultDoctorId = availableDoctors.length > 0 ? availableDoctors[0].id : '';

    conflicts.forEach((conf) => {
      initialMap[conf.id] = {
        action: 'reassign',
        newDoctorId: defaultDoctorId,
        cancelReason: `Doctor ${request?.doctor_name || ''} is on approved leave. Priority rebooking/refund offered.`,
      };
    });

    setResolutions(initialMap);
    setSubmitError(null);
  }, [isOpen, conflicts, availableDoctors]);

  const handleActionChange = (conflictId: string, action: 'reassign' | 'cancel') => {
    setResolutions((prev) => ({
      ...prev,
      [conflictId]: {
        ...prev[conflictId],
        action,
      },
    }));
  };

  const handleDoctorChange = (conflictId: string, doctorId: string) => {
    setResolutions((prev) => ({
      ...prev,
      [conflictId]: {
        ...prev[conflictId],
        newDoctorId: doctorId,
      },
    }));
  };

  const handleReasonChange = (conflictId: string, reason: string) => {
    setResolutions((prev) => ({
      ...prev,
      [conflictId]: {
        ...prev[conflictId],
        cancelReason: reason,
      },
    }));
  };

  const handleSubmit = async () => {
    setSubmitError(null);

    const payloadResolutions = [];
    for (const conf of conflicts) {
      const resState = resolutions[conf.id];
      if (!resState) continue;

      if (resState.action === 'reassign') {
        if (!resState.newDoctorId) {
          setSubmitError(`Please select a suggested doctor for patient ${conf.patient_name}.`);
          return;
        }

        payloadResolutions.push({
          appointment_id: conf.id,
          action: 'reassign',
          new_doctor_id: resState.newDoctorId,
          reason: `Doctor ${request?.doctor_name || ''} is on approved leave. Suggested alternate doctor for patient self-reschedule.`,
        });
      } else {
        payloadResolutions.push({
          appointment_id: conf.id,
          action: 'cancel',
          reason: resState.cancelReason || 'Cancelled due to approved doctor leave.',
        });
      }
    }

    setIsSubmitting(true);
    try {
      await onConfirm(payloadResolutions);
      onClose();
    } catch (err: any) {
      console.error('Failed to submit conflict resolutions:', err);
      setSubmitError(err.response?.data?.message || err.message || 'Failed to approve leave with resolutions.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !request) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div 
        style={{
          backgroundColor: 'var(--card-bg, #ffffff)',
          color: 'var(--primary-text, #0f172a)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '850px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px var(--border, #e2e8f0)',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div 
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.05) 0%, rgba(2, 132, 199, 0.05) 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div 
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: '#fef3c7',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <ShieldAlert size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary-text, #0f172a)' }}>
                Resolve Appointment Conflicts
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--secondary-text, #64748b)' }}>
                Leave approval for <strong style={{ color: 'var(--primary-teal, #0d9488)' }}>{request.doctor_name}</strong> ({request.start_date} to {request.end_date})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--secondary-text, #64748b)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.2s',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Notice Banner */}
        <div 
          style={{
            padding: '12px 24px',
            backgroundColor: '#fffbeb',
            borderBottom: '1px solid #fef3c7',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.86rem',
            color: '#92400e'
          }}
        >
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span>
            <strong>{conflicts.length} booked appointment(s)</strong> clash with this leave request. 
            Select a suggested doctor for each patient (or cancel). The patient will be notified to open their portal and pick their own convenient time slot.
          </span>
        </div>

        {/* Scrollable Conflict List */}
        <div 
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}
        >
          {conflicts.map((conf, index) => {
            const resState = resolutions[conf.id] || {
              action: 'reassign',
              newDoctorId: availableDoctors.length > 0 ? availableDoctors[0].id : '',
              cancelReason: ''
            };

            const selectedDoc = availableDoctors.find((d) => d.id === resState.newDoctorId);

            return (
              <div 
                key={conf.id}
                style={{
                  border: '1px solid var(--border, #e2e8f0)',
                  borderRadius: '12px',
                  backgroundColor: 'var(--surface-1, #f8fafc)',
                  padding: '16px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                {/* Conflict Header / Patient Summary */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div 
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary-teal, #0d9488)',
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.8rem',
                        fontWeight: 700
                      }}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--primary-text, #0f172a)' }}>
                        {conf.patient_name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--secondary-text, #64748b)' }}>
                        Phone: {conf.patient_phone || 'N/A'} • {conf.treatment_type || 'Consultation'} ({conf.consultation_type === 'in_person' ? 'In-Person' : 'Teleconsult'})
                      </div>
                    </div>
                  </div>

                  {/* Scheduled Date & Time Badge */}
                  <div 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      backgroundColor: '#e2e8f0',
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      color: '#1e293b'
                    }}
                  >
                    <Calendar size={14} style={{ color: '#0284c7' }} />
                    <span>{conf.date}</span>
                    <span style={{ color: '#94a3b8' }}>•</span>
                    <Clock size={14} style={{ color: '#0284c7' }} />
                    <span>{formatTime12h(conf.time)}</span>
                  </div>
                </div>

                {/* Resolution Action Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '4px' }}>
                  <label style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--secondary-text, #64748b)' }}>
                    Action:
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => handleActionChange(conf.id, 'reassign')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        border: '1px solid',
                        borderColor: resState.action === 'reassign' ? 'var(--primary-teal, #0d9488)' : 'var(--border, #cbd5e1)',
                        backgroundColor: resState.action === 'reassign' ? 'var(--primary-teal, #0d9488)' : 'var(--card-bg, #ffffff)',
                        color: resState.action === 'reassign' ? '#ffffff' : 'var(--primary-text, #334155)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <UserCheck size={14} /> Suggest Alternate Doctor
                    </button>
                    <button
                      type="button"
                      onClick={() => handleActionChange(conf.id, 'cancel')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '20px',
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        border: '1px solid',
                        borderColor: resState.action === 'cancel' ? '#ef4444' : 'var(--border, #cbd5e1)',
                        backgroundColor: resState.action === 'cancel' ? '#ef4444' : 'var(--card-bg, #ffffff)',
                        color: resState.action === 'cancel' ? '#ffffff' : 'var(--primary-text, #334155)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <XCircle size={14} /> Cancel Appointment
                    </button>
                  </div>
                </div>

                {/* Sub-Panel: SUGGEST DOCTOR */}
                {resState.action === 'reassign' && (
                  <div 
                    style={{
                      backgroundColor: 'var(--card-bg, #ffffff)',
                      border: '1px solid var(--border, #e2e8f0)',
                      borderRadius: '10px',
                      padding: '14px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '6px', color: 'var(--secondary-text, #64748b)' }}>
                        Suggested Replacement Doctor:
                      </label>
                      <select
                        value={resState.newDoctorId}
                        onChange={(e) => handleDoctorChange(conf.id, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border, #cbd5e1)',
                          backgroundColor: 'var(--surface-1, #f8fafc)',
                          color: 'var(--primary-text, #0f172a)',
                          fontSize: '0.88rem',
                          fontWeight: 500
                        }}
                      >
                        {availableDoctors.length === 0 && (
                          <option value="">No alternative doctors available in branch</option>
                        )}
                        {availableDoctors.map((doc) => (
                          <option key={doc.id} value={doc.id}>
                            {doc.name} — {doc.specialization || doc.department || 'Specialist'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div 
                      style={{ 
                        fontSize: '0.82rem', 
                        color: '#0f766e', 
                        backgroundColor: '#f0fdfa',
                        border: '1px solid #ccfbf1',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px' 
                      }}
                    >
                      <Sparkles size={16} color="var(--primary-teal, #0d9488)" style={{ flexShrink: 0 }} />
                      <span>
                        <strong>Dr. {selectedDoc?.name || 'Selected Doctor'}</strong> will be suggested to {conf.patient_name}. The patient will receive a notification to visit their portal and select their own convenient date &amp; time slot.
                      </span>
                    </div>
                  </div>
                )}

                {/* Sub-Panel: CANCEL APPOINTMENT */}
                {resState.action === 'cancel' && (
                  <div 
                    style={{
                      backgroundColor: 'var(--card-bg, #ffffff)',
                      border: '1px solid #fecaca',
                      borderRadius: '10px',
                      padding: '12px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#991b1b' }}>
                      Cancellation Reason for Patient:
                    </label>
                    <input
                      type="text"
                      value={resState.cancelReason}
                      onChange={(e) => handleReasonChange(conf.id, e.target.value)}
                      placeholder="Reason for cancellation..."
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #f87171',
                        fontSize: '0.85rem'
                      }}
                    />
                    <span style={{ fontSize: '0.76rem', color: '#b91c1c' }}>
                      Appointment will be marked cancelled. Patient will receive an instant notification to book an alternate appointment.
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Error message */}
        {submitError && (
          <div 
            style={{
              padding: '10px 24px',
              backgroundColor: '#fee2e2',
              borderTop: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: '0.86rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertTriangle size={16} />
            <span>{submitError}</span>
          </div>
        )}

        {/* Footer */}
        <div 
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
            backgroundColor: 'var(--surface-1, #f8fafc)'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: '1px solid var(--border, #cbd5e1)',
              backgroundColor: 'var(--card-bg, #ffffff)',
              color: 'var(--primary-text, #334155)',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              padding: '9px 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#10b981',
              color: '#ffffff',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 2px 4px rgba(16, 185, 129, 0.3)',
              transition: 'all 0.2s ease'
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Resolving &amp; Approving…
              </>
            ) : (
              <>
                <CheckCircle size={16} />
                Confirm Resolutions &amp; Approve Leave
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
