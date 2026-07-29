import React, { useState } from 'react';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { X, Shield, FileText, CheckCircle, User, Activity, AlertCircle } from 'lucide-react';
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
  specialty = 'General Dentistry',
  isDoctor = false,
  onClose,
}) => {
  const roomName = `VerticalClinic_Teleconsult_${appointmentId.replace(/-/g, '').slice(0, 12)}`;
  const displayName = isDoctor ? `Dr. ${doctorName}` : patientName;

  // Clinical notes state (for Doctor mode split-screen)
  const [clinicalNotes, setClinicalNotes] = useState<string>('');
  const [prescriptionText, setPrescriptionText] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(false);

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
          <div className="jitsi-video-wrapper">
            <JitsiMeeting
              domain="meet.jit.si"
              roomName={roomName}
              configOverwrite={{
                startWithAudioMuted: false,
                startWithVideoMuted: false,
                disableThirdPartyRequests: true,
                prejoinPageEnabled: false,
                enableWelcomePage: false,
                disableDeepLinking: true,
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
              }}
              onReadyToClose={onClose}
              getIFrameRef={(iframeRef) => {
                iframeRef.style.height = '100%';
                iframeRef.style.width = '100%';
                iframeRef.style.border = 'none';
              }}
            />
          </div>

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
