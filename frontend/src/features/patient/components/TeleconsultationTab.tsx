import React, { useState, useEffect } from 'react';
import { Video, Clock, CheckSquare, Square, AlertCircle, MessageSquare } from 'lucide-react';
import { ChatDrawerModal } from './ChatDrawerModal';

interface TeleconsultationTabProps {
  activeTele: any;
  pastTeles: any[];
  selectedTeleId: string | null;
  setSelectedTeleId: (id: string | null) => void;
  checklist: any[];
  handleJoinMeeting: (id: string) => void;
  triggerToast: (type: 'success' | 'error', message: string) => void;
  setScreen: (screen: any) => void;
}

interface ChecklistState {
  net: boolean;
  light: boolean;
  media: boolean;
  symptoms: boolean;
  report: boolean;
}

export const TeleconsultationTab: React.FC<TeleconsultationTabProps> = ({
  activeTele,
  pastTeles,
  selectedTeleId,
  setSelectedTeleId,
  checklist: _checklist,
  handleJoinMeeting,
  triggerToast,
  setScreen,
}) => {
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);

  const allConsultations: any[] = [];
  if (activeTele) {
    allConsultations.push({ ...activeTele, status: 'scheduled' });
  }
  if (pastTeles && pastTeles.length > 0) {
    allConsultations.push(...pastTeles);
  }

  const currentSelectedId = selectedTeleId || allConsultations[0]?.id;
  const selectedItem = allConsultations.find(c => c.id === currentSelectedId) || allConsultations[0];

  // ── Pre-consultation Checklist State (persisted in localStorage) ────────────
  const [checklistState, setChecklistState] = useState<ChecklistState>(() => {
    const key = `tele_checklist_${selectedItem?.id || 'default'}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing checklist state:', e);
      }
    }
    return {
      net: true,
      light: true,
      media: true,
      symptoms: true,
      report: false,
    };
  });

  useEffect(() => {
    if (selectedItem?.id) {
      const key = `tele_checklist_${selectedItem.id}`;
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          setChecklistState(JSON.parse(saved));
          return;
        } catch (e) {
          console.error(e);
        }
      }
      setChecklistState({
        net: true,
        light: true,
        media: true,
        symptoms: true,
        report: false,
      });
    }
  }, [selectedItem?.id]);

  const toggleChecklistItem = (key: keyof ChecklistState) => {
    setChecklistState((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      if (selectedItem?.id) {
        localStorage.setItem(`tele_checklist_${selectedItem.id}`, JSON.stringify(updated));
      }
      return updated;
    });
  };

  const isMandatoryComplete =
    checklistState.net &&
    checklistState.light &&
    checklistState.media &&
    checklistState.symptoms;

  const totalItems = 5;
  const completedCount = Object.values(checklistState).filter(Boolean).length;
  const progressPercent = Math.round((completedCount / totalItems) * 100);

  if (allConsultations.length === 0) {
    return (
      <div className="tele-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', maxWidth: '420px', padding: '40px', background: 'var(--surface-2)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          <div className="tele-video-icon-wrap" style={{ margin: '0 auto 20px', width: '80px', height: '80px', background: 'var(--primary-light)', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Video size={36} className="tele-video-icon" style={{ color: 'var(--primary)' }} />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--ink)', marginBottom: '8px' }}>No Tele Consultations</h3>
          <p style={{ color: 'var(--muted)', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '24px' }}>
            You don't have any upcoming or past video consultations scheduled. You can book one anytime.
          </p>
          <button className="btn-primary" onClick={() => setScreen('book')} style={{ width: '100%', justifyContent: 'center' }}>
            Book Tele Consultation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="tele-page">
      <div className="tele-grid">
        {/* Left Column: Details Box */}
        <div className="tele-main-card">
          {selectedItem?.status === 'scheduled' ? (
            <>
              <div className="tele-video-icon-wrap">
                <Video size={48} className="tele-video-icon" />
              </div>
              <h2 className="tele-title">Video Consultation with {selectedItem.doctor_name}</h2>
              <p className="tele-subtitle">Scheduled for {selectedItem.scheduled_time || `${selectedItem.date} at ${selectedItem.time}`}</p>
              
              {selectedItem.is_expired ? (
                <div className="tele-timer-badge" style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fee2e2' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', marginRight: '6px' }}></span>
                  Session Expired / Time Passed
                </div>
              ) : selectedItem.is_ongoing || selectedItem.time_left_minutes === 0 ? (
                <div className="tele-timer-badge" style={{ background: '#ecfdf5', color: '#10b981', border: '1px solid #a7f3d0' }}>
                  <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', marginRight: '6px' }}></span>
                  Session Live / Ongoing
                </div>
              ) : (
                <div className="tele-timer-badge">
                  <Clock size={14} /> Starts in {selectedItem.time_left_minutes} minutes
                </div>
              )}

              {/* Status Banner */}
              {(() => {
                const minutesLeft = selectedItem.time_left_minutes || 0;
                const hasLink = !!selectedItem.meeting_link;
                const canJoin = !!selectedItem.can_join;
                const isExpired = !!selectedItem.is_expired;

                if (isExpired) {
                  return (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      background: '#fef2f2', border: '1px solid #fee2e2', color: '#ef4444',
                      padding: '10px 14px', borderRadius: '6px', fontSize: '0.82rem', margin: '14px 0',
                      fontWeight: 500, textAlign: 'left'
                    }}>
                      <span>⚠️ This consultation session has expired or the scheduled time slot has passed. Please contact the clinic if you need to reschedule.</span>
                    </div>
                  );
                } else if (canJoin && isMandatoryComplete) {
                  return (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a',
                      padding: '10px 14px', borderRadius: '6px', fontSize: '0.82rem', margin: '14px 0',
                      fontWeight: 500, textAlign: 'left'
                    }}>
                      <span>✅ {selectedItem.doctor_name?.startsWith('Dr.') ? selectedItem.doctor_name : `Dr. ${selectedItem.doctor_name || 'Clinician'}`} is ready and pre-checks are complete. Click below to join room.</span>
                    </div>
                  );
                } else if (canJoin && !isMandatoryComplete) {
                  return (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      background: '#fff7ed', border: '1px solid #ffedd5', color: '#c2410c',
                      padding: '10px 14px', borderRadius: '6px', fontSize: '0.82rem', margin: '14px 0',
                      fontWeight: 500, textAlign: 'left'
                    }}>
                      <AlertCircle size={16} style={{ flexShrink: 0 }} />
                      <span>🔒 Room is open, but please complete all mandatory Pre-Consultation Checklist items on the right to unlock "Join Meeting".</span>
                    </div>
                  );
                } else if (hasLink || (minutesLeft > 0 && minutesLeft <= 30)) {
                  return (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb',
                      padding: '10px 14px', borderRadius: '6px', fontSize: '0.82rem', margin: '14px 0',
                      fontWeight: 500, textAlign: 'left'
                    }}>
                      <span>💻 Your consultation room is ready! The "Join Meeting" button will activate 10 minutes before your start time once checklist is ready.</span>
                    </div>
                  );
                } else {
                  return (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      background: '#fef3c7', border: '1px solid #fde68a', color: '#d97706',
                      padding: '10px 14px', borderRadius: '6px', fontSize: '0.82rem', margin: '14px 0',
                      fontWeight: 500, textAlign: 'left'
                    }}>
                      <span>🕒 A secure consultation room will be prepared 30 minutes before your appointment.</span>
                    </div>
                  );
                }
              })()}

              {/* Join Meeting Action Button */}
              <button
                onClick={() => handleJoinMeeting(selectedItem.id)}
                className="tele-btn-join"
                disabled={!selectedItem.can_join || !isMandatoryComplete}
                style={{
                  cursor: (selectedItem.can_join && isMandatoryComplete) ? 'pointer' : 'not-allowed',
                  opacity: (selectedItem.can_join && isMandatoryComplete) ? 1 : 0.55,
                  backgroundColor: (selectedItem.can_join && isMandatoryComplete) ? 'var(--primary, #0ea5e9)' : '#94a3b8',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
                title={!isMandatoryComplete ? 'Please complete all required pre-consultation checklist items to enable' : ''}
              >
                <Video size={16} /> 
                {(!isMandatoryComplete && selectedItem.can_join) ? '🔒 Complete Checklist to Join' : 'Join Meeting'}
              </button>

              {/* Direct Messaging Drawer Button */}
              <button
                className="tele-btn-message"
                onClick={() => setIsChatOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                }}
              >
                <MessageSquare size={16} /> Send Direct Message to Clinic
              </button>
            </>
          ) : (
            <div style={{ width: '100%', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
                <div className="tele-past-avatar" style={{ width: '50px', height: '50px', fontSize: '1.1rem' }}>
                  {selectedItem.doctor_name ? selectedItem.doctor_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'DR'}
                </div>
                <div style={{ flex: 1 }}>
                  <h2 className="tele-title" style={{ margin: 0, fontSize: '1.2rem' }}>{selectedItem.doctor_name}</h2>
                  <p className="tele-subtitle" style={{ margin: '2px 0 0 0', fontSize: '0.82rem' }}>{selectedItem.specialty} • Completed Call</p>
                </div>
                <span className="tele-status-chip">Completed</span>
              </div>

              <div className="tele-summary-section">
                <h4 className="tele-summary-heading">Session Details</h4>
                <table className="tele-details-table">
                  <tbody>
                    <tr>
                      <td>Date &amp; Time</td>
                      <td>{selectedItem.date} at {selectedItem.time || '10:00 AM'}</td>
                    </tr>
                    <tr>
                      <td>Call Duration</td>
                      <td>{selectedItem.duration}</td>
                    </tr>
                    <tr>
                      <td>Consultation ID</td>
                      <td style={{ fontFamily: 'monospace' }}>{selectedItem.id}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="tele-summary-section" style={{ marginTop: '20px' }}>
                <h4 className="tele-summary-heading">Doctor's Clinical Notes</h4>
                <p className="tele-summary-text">{selectedItem.notes}</p>
              </div>

              <div className="tele-summary-section" style={{ marginTop: '20px' }}>
                <h4 className="tele-summary-heading">Prescriptions / Medications</h4>
                <div className="tele-summary-rx">
                  <span className="tele-rx-icon">💊</span>
                  <span>{selectedItem.prescription}</span>
                </div>
              </div>

              <div className="tele-summary-section" style={{ marginTop: '20px' }}>
                <h4 className="tele-summary-heading">Doctor's Recommendations</h4>
                <p className="tele-summary-text" style={{ fontStyle: 'italic' }}>{selectedItem.recommendations}</p>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                <button
                  className="btn-secondary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => setIsChatOpen(true)}
                >
                  <MessageSquare size={14} /> Message Clinic
                </button>

                <button
                  className="btn-secondary"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => triggerToast('success', 'Summary receipt sent to registered email address.')}
                >
                  ✉ Email Summary PDF
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: List & Interactive Checklist */}
        <div className="tele-sidebar-cards">
          {/* Pre-Consultation Interactive Checklist */}
          <div className="tele-checklist-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 className="tele-card-title" style={{ margin: 0 }}>Pre-Consultation Checklist</h3>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: isMandatoryComplete ? '#16a34a' : '#ea580c',
                  backgroundColor: isMandatoryComplete ? '#f0fdf4' : '#fff7ed',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  border: isMandatoryComplete ? '1px solid #bbf7d0' : '1px solid #ffedd5',
                }}
              >
                {progressPercent}% Done
              </span>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--muted, #64748b)', margin: '0 0 12px 0', lineHeight: 1.4 }}>
              Complete the 4 required steps below to unlock your video consultation:
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { key: 'net', label: 'Stable Internet connection tested', req: true },
                { key: 'light', label: 'Good lighting on your face', req: true },
                { key: 'media', label: 'Camera & Microphone working', req: true },
                { key: 'symptoms', label: 'List of current symptoms ready', req: true },
                { key: 'report', label: 'Recent diagnostic report uploaded', req: false },
              ].map(({ key, label, req }) => {
                const isChecked = checklistState[key as keyof ChecklistState];
                return (
                  <div
                    key={key}
                    onClick={() => toggleChecklistItem(key as keyof ChecklistState)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      backgroundColor: isChecked ? '#f0fdf4' : '#ffffff',
                      border: isChecked ? '1px solid #bbf7d0' : '1px solid #e2e8f0',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      userSelect: 'none',
                    }}
                  >
                    {isChecked ? (
                      <CheckSquare size={18} color="#16a34a" style={{ flexShrink: 0 }} />
                    ) : (
                      <Square size={18} color="#94a3b8" style={{ flexShrink: 0 }} />
                    )}

                    <span
                      style={{
                        fontSize: '0.83rem',
                        fontWeight: isChecked ? 600 : 400,
                        color: isChecked ? '#15803d' : '#334155',
                        textDecoration: isChecked ? 'none' : 'none',
                        flex: 1,
                      }}
                    >
                      {label} {req && <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>*</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* All Consultations List */}
          <div className="tele-past-card">
            <h3 className="tele-card-title">All Tele Consultations</h3>
            <div className="tele-past-list">
              {allConsultations.map((item) => {
                const isSelected = item.id === currentSelectedId;
                const isUpcoming = item.status === 'scheduled';
                return (
                  <div
                    key={item.id}
                    className={`tele-past-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedTeleId(item.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="tele-past-avatar" style={{ background: isUpcoming ? 'var(--warning-bg)' : 'var(--primary-light)', color: isUpcoming ? 'var(--warning)' : 'var(--primary)' }}>
                        {isUpcoming ? '⏰' : (item.doctor_name ? item.doctor_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'DR')}
                      </div>
                      <div style={{ textAlign: 'left' }}>
                        <div className="tele-past-doc">{item.doctor_name}</div>
                        <div className="tele-past-date">
                          {isUpcoming ? (item.scheduled_time || `${item.date} at ${item.time}`) : `${item.date} • ${item.duration}`}
                        </div>
                      </div>
                    </div>
                    <span className={`tele-status-chip ${isUpcoming ? 'pending' : ''}`} style={{ background: isUpcoming ? 'var(--warning-bg)' : 'var(--success-bg)', color: isUpcoming ? 'var(--warning)' : 'var(--success)', alignSelf: 'center' }}>
                      {isUpcoming ? 'Upcoming' : 'Completed'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Slide-over Chat Drawer Modal */}
      <ChatDrawerModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        appointment={selectedItem}
        triggerToast={triggerToast}
      />
    </div>
  );
};
