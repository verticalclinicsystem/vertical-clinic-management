import React from 'react';
import { Settings, Bell } from 'lucide-react';

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
    <div className="card" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="card-title-bar">
        <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={18} /> Portal Settings &amp; Preferences
        </h3>
      </div>

      <form onSubmit={handlePreferencesSubmit} style={{ padding: '8px 4px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <Bell size={16} className="text-primary" style={{ color: 'var(--primary-teal)' }} />
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Notification Preferences</h4>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
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
        </div>

        <button type="submit" className="btn-primary" style={{ marginTop: '28px', width: '100%', justifyContent: 'center' }}>
          Save Preferences
        </button>
      </form>
    </div>
  );
};

