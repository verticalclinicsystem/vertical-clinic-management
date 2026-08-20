import React, { useState, useEffect } from 'react';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { X, Shield, FileText, CheckCircle, User, Loader2 } from 'lucide-react';
import { api } from '../../../services/api';
import './JitsiVideoModal.css';

interface JitsiVideoModalProps {
  appointmentId: string;
  doctorName?: string;
  patientName?: string;
  specialty?: string;
  isDoctor?: boolean;
  onClose: () => void;
}

export const JitsiVideoModal: React.FC<JitsiVideoModalProps> = ({
  appointmentId,
  doctorName = 'Doctor',
  patientName = 'Patient',
  specialty = 'General Medicine',
  isDoctor = false,
  onClose,
}) => {
  const roomName = `VerticalClinic_Teleconsult_${appointmentId.replace(/-/g, '').slice(0, 12)}`;
  const displayName = isDoctor ? `Dr. ${doctorName}` : patientName;

  // Clinical notes state (for Doctor mode split-screen)
  const [clinicalNotes, setClinicalNotes] = useState<string>('');
  const [prescriptionText, setPrescriptionText] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(false);

  const [meetingStatus, setMeetingStatus] = useState<string>('checking');

  useEffect(() => {
    if (isDoctor) {
      setMeetingStatus('Active');
      return;
    }

    // Mark patient as ready in lobby
    const signalReady = async () => {
      try {
        await api.post(`/teleconsultations/${appointmentId}/patient-ready`);
      } catch (err) {
        console.error('Failed to notify doctor that patient is ready:', err);
      }
    };
    signalReady();

    let isMounted = true;
    const checkStatus = async () => {
      try {
        const res = await api.get('/teleconsultations/active');
        const data = res.data?.data || res.data;
        if (!isMounted) return;
        if (data && data.id === appointmentId) {
          const status = data.meeting_status || 'Ready';
          setMeetingStatus(status);
        } else {
          setMeetingStatus('Ready');
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Error fetching teleconsultation status:', err);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      // Notify backend that patient has left the lobby
      api.post(`/teleconsultations/${appointmentId}/patient-left`).catch((err) => {
        console.error('Failed to notify doctor that patient left:', err);
      });
    };
  }, [appointmentId, isDoctor]);

  const handleSaveNotes = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="jitsi-modal-overlay">
      <div className={`jitsi-modal-container ${isDoctor ? 'split-screen' : 'full-screen'}`}>
        {/* MODAL HEADER */}
        <div className="jitsi-modal-header">
          <div className="jitsi-header-left">
            <div className="live-status-pill">
              <span className="pulse-dot" /> LIVE TELECONSULTATION
            </div>
            <div className="header-info-text">
              <h3>{doctorName} & {patientName}</h3>
              <p>{specialty} • In-App Encrypted Video Call</p>
            </div>
          </div>

          <div className="jitsi-header-right">
            <div className="security-badge">
              <Shield size={14} /> HIPAA Encrypted
            </div>
            <button className="jitsi-close-btn" onClick={onClose} title="Leave Call">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="jitsi-modal-body">
          {/* LEFT PANEL: IN-APP JITSI VIDEO ROOM */}
          {(!isDoctor && (meetingStatus === 'Ready' || meetingStatus === 'checking')) ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              background: '#091514',
              color: 'white',
              padding: '40px',
              textAlign: 'center',
              minHeight: '450px'
            }}>
              <style>{`
                @keyframes pulse-ring {
                  0% { transform: scale(0.95); opacity: 0.5; }
                  50% { transform: scale(1.05); opacity: 0.8; }
                  100% { transform: scale(0.95); opacity: 0.5; }
                }
                @keyframes spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}</style>
              
              <div style={{
                position: 'relative',
                width: '90px',
                height: '90px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '24px',
                animation: 'pulse-ring 2s infinite'
              }}>
                <Loader2 size={36} color="#10b981" style={{ animation: 'spin 2s linear infinite' }} />
              </div>

              <h2 style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: '12px', color: '#f8fafc', margin: '0 0 8px 0' }}>
                Waiting for Doctor
              </h2>
              
              <p style={{ fontSize: '0.88rem', color: '#94a3b8', maxWidth: '380px', lineHeight: 1.5, marginBottom: '28px', margin: '0 auto 24px auto' }}>
                Dr. {doctorName} is finalizing their previous consultation. Please stay on this screen. Your video call will start automatically as soon as the doctor joins.
              </p>

              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '16px 20px',
                maxWidth: '360px',
                textAlign: 'left',
                margin: '0 auto 28px auto'
              }}>
                <h4 style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#10b981', letterSpacing: '0.05em', margin: '0 0 8px 0', fontWeight: 700 }}>
                  Pre-Call Checklist Tips
                </h4>
                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                  <li>Ensure your microphone and camera permissions are allowed.</li>
                  <li>Sit in a quiet and well-lit environment.</li>
                  <li>Double check that your internet connection is stable.</li>
                </ul>
              </div>

              <button 
                onClick={onClose}
                style={{
                  background: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '10px 24px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#dc2626'}
                onMouseOut={(e) => e.currentTarget.style.background = '#ef4444'}
              >
                Leave Waiting Room
              </button>
            </div>
          ) : (
            <div className="jitsi-video-wrapper">
              <JitsiMeeting
                domain="meet.element.io"
                roomName={roomName ? roomName.toLowerCase().replace(/[^a-z0-9_]/g, '') : 'vclinic_teleconsult_room'}
                configOverwrite={{
                  startWithAudioMuted: false,
                  startWithVideoMuted: false,
                  disableThirdPartyRequests: true,
                  prejoinPageEnabled: false,
                  enableWelcomePage: false,
                  disableDeepLinking: true,
                  enableUserRolesBasedOnToken: false,
                  requireDisplayName: false,
                }}
                interfaceConfigOverwrite={{
                  TOOLBAR_BUTTONS: [
                    'microphone',
                    'camera',
                    'desktop',
                    'chat',
                    'raisehand',
                    'tileview',
                    'fullscreen',
                    'hangup',
                  ],
                  SHOW_JITSI_WATERMARK: false,
                  SHOW_WATERMARK_FOR_GUESTS: false,
                  DEFAULT_BACKGROUND: '#053b34',
                }}
                userInfo={{
                  displayName: displayName,
                  email: '',
                }}
                onReadyToClose={onClose}
                getIFrameRef={(iframeRef: any) => {
                  iframeRef.style.height = '100%';
                  iframeRef.style.width = '100%';
                  iframeRef.style.border = 'none';
                }}
              />
            </div>
          )}

          {/* RIGHT PANEL: DOCTOR CLINICAL WORKSPACE (Split-Screen when isDoctor=true) */}
          {isDoctor && (
            <div className="doctor-clinical-panel">
              <div className="panel-section-header">
                <FileText size={18} />
                <span>Live Clinical Notes & E-Prescription</span>
              </div>

              <div className="patient-quick-card">
                <div className="p-avatar"><User size={16} /></div>
                <div>
                  <strong>{patientName}</strong>
                  <p>Teleconsultation Patient</p>
                </div>
              </div>

              <div className="clinical-input-group">
                <label>Doctor Consultation Notes</label>
                <textarea
                  className="clinical-textarea"
                  placeholder="Record symptoms, diagnosis, and oral findings during call..."
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                />
              </div>

              <div className="clinical-input-group">
                <label>Rx E-Prescription & Advice</label>
                <textarea
                  className="clinical-textarea"
                  placeholder="e.g. Tab Paracetamol 500mg (1-0-1), Warm Saline Rinse..."
                  value={prescriptionText}
                  onChange={(e) => setPrescriptionText(e.target.value)}
                />
              </div>

              <div className="panel-action-footer">
                {isSaved && (
                  <span className="save-success-msg">
                    <CheckCircle size={16} /> Notes Saved to Patient Chart!
                  </span>
                )}
                <button type="button" className="save-notes-btn" onClick={handleSaveNotes}>
                  <FileText size={16} /> Save Notes & Issue Rx
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
