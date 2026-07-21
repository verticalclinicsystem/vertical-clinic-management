import React from 'react';
import { Video } from 'lucide-react';

interface PreferencesTabProps {
  preferences: any;
  setPreferences: (pref: any) => void;
  handlePreferencesSubmit: (e: React.FormEvent) => void;
}

export const PreferencesTab: React.FC<PreferencesTabProps> = ({
  preferences,
  setPreferences,
  handlePreferencesSubmit,
}) => {
  return (
    <div className="card">
      <div className="card-title-bar">
        <h3 className="card-title"><Video size={18} /> Portal Settings &amp; Preferences</h3>
      </div>

      <form onSubmit={handlePreferencesSubmit} className="pref-grid">
        <div>
          <h4 style={{ marginBottom: '14px', fontSize: '0.95rem' }}>General Settings</h4>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Preferred Portal Language</label>
            <select
              value={preferences.language || 'English'}
              onChange={(e) => setPreferences({ ...preferences, language: e.target.value })}
              className="form-input"
            >
              <option value="English">English</option>
              <option value="Spanish">Spanish (Español)</option>
              <option value="Hindi">Hindi (हिंदी)</option>
              <option value="Gujarati">Gujarati (ગુજરાતી)</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Preferred Consultation Format</label>
            <select
              value={preferences.consultation_preference || 'in_person'}
              onChange={(e) => setPreferences({ ...preferences, consultation_preference: e.target.value })}
              className="form-input"
            >
              <option value="in_person">In Person Clinic Visit</option>
              <option value="teleconsultation">Video Consultation / Telehealth</option>
            </select>
          </div>
        </div>

        <div>
          <h4 style={{ marginBottom: '14px', fontSize: '0.95rem' }}>Notification Preferences</h4>
          <div className="toggle-row">
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Email Notifications</div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Send appointment reminders &amp; receipts</span>
            </div>
            <input
              type="checkbox"
              checked={preferences.notification_email}
              onChange={(e) => setPreferences({ ...preferences, notification_email: e.target.checked })}
              style={{ transform: 'scale(1.2)' }}
            />
          </div>

          <div className="toggle-row">
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>SMS Notifications</div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Send brief reminders on your mobile</span>
            </div>
            <input
              type="checkbox"
              checked={preferences.notification_sms}
              onChange={(e) => setPreferences({ ...preferences, notification_sms: e.target.checked })}
              style={{ transform: 'scale(1.2)' }}
            />
          </div>

          <div className="toggle-row">
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>WhatsApp Alerts</div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Send instant booking alerts on WhatsApp</span>
            </div>
            <input
              type="checkbox"
              checked={preferences.notification_whatsapp}
              onChange={(e) => setPreferences({ ...preferences, notification_whatsapp: e.target.checked })}
              style={{ transform: 'scale(1.2)' }}
            />
          </div>

          <div className="toggle-row">
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Browser Push Notifications</div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Allow live status updates</span>
            </div>
            <input
              type="checkbox"
              checked={preferences.notification_push}
              onChange={(e) => setPreferences({ ...preferences, notification_push: e.target.checked })}
              style={{ transform: 'scale(1.2)' }}
            />
          </div>

          <button type="submit" className="btn-primary" style={{ marginTop: '20px', width: '100%' }}>
            Save Preferences
          </button>
        </div>
      </form>
    </div>
  );
};
