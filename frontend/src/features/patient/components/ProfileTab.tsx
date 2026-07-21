import React from 'react';
import { User } from 'lucide-react';

interface ProfileTabProps {
  patientProfile: any;
  isEditingProfile: boolean;
  setIsEditingProfile: (editing: boolean) => void;
  profileForm: any;
  setProfileForm: (form: any) => void;
  startEditingProfile: () => void;
  handleSaveProfile: (e: React.FormEvent) => void;
  getInitials?: (name?: string) => string;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  patientProfile,
  isEditingProfile,
  setIsEditingProfile,
  profileForm,
  setProfileForm,
  startEditingProfile,
  handleSaveProfile,
}) => {
  if (!patientProfile) return null;

  return (
    <div className="card">
      <div className="card-title-bar">
        <h3 className="card-title"><User size={18} /> Profile Information</h3>
        {!isEditingProfile ? (
          <button
            onClick={startEditingProfile}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600 }}
          >
            Edit Profile
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setIsEditingProfile(false)}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveProfile}
              className="btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.85rem', fontWeight: 600 }}
            >
              Save Changes
            </button>
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginTop: '16px' }}>
        <div>
          <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Full Name</label>
          <div className="form-input" style={{ backgroundColor: '#f8fafc', fontWeight: 600 }}>{patientProfile.user?.full_name}</div>
        </div>
        <div>
          <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Email Address</label>
          <div className="form-input" style={{ backgroundColor: '#f8fafc' }}>{patientProfile.user?.email}</div>
        </div>
        <div>
          <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Phone Number</label>
          {isEditingProfile ? (
            <input
              type="text"
              value={profileForm.phone}
              onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
              className="form-input"
            />
          ) : (
            <div className="form-input" style={{ backgroundColor: '#f8fafc' }}>{patientProfile.user?.phone || 'Not set'}</div>
          )}
        </div>
        <div>
          <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Patient ID Code</label>
          <div className="form-input" style={{ backgroundColor: '#f8fafc', fontFamily: 'monospace' }}>{patientProfile.patient_code}</div>
        </div>
        <div>
          <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Blood Group</label>
          {isEditingProfile ? (
            <select
              value={profileForm.blood_group}
              onChange={e => setProfileForm({ ...profileForm, blood_group: e.target.value })}
              className="form-input"
              style={{ padding: '8px 12px' }}
            >
              <option value="">Select Blood Group</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          ) : (
            <div className="form-input" style={{ backgroundColor: '#f8fafc' }}>{patientProfile.blood_group || 'Not recorded'}</div>
          )}
        </div>
        <div>
          <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Date of Birth</label>
          {isEditingProfile ? (
            <input
              type="date"
              value={profileForm.date_of_birth}
              onChange={e => setProfileForm({ ...profileForm, date_of_birth: e.target.value })}
              className="form-input"
            />
          ) : (
            <div className="form-input" style={{ backgroundColor: '#f8fafc' }}>
              {patientProfile.date_of_birth ? new Date(patientProfile.date_of_birth).toLocaleDateString() : 'Not set'}
            </div>
          )}
        </div>
        <div>
          <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Emergency Contact Name</label>
          {isEditingProfile ? (
            <input
              type="text"
              value={profileForm.emergency_contact_name}
              onChange={e => setProfileForm({ ...profileForm, emergency_contact_name: e.target.value })}
              className="form-input"
            />
          ) : (
            <div className="form-input" style={{ backgroundColor: '#f8fafc' }}>{patientProfile.emergency_contact_name || 'Not set'}</div>
          )}
        </div>
        <div>
          <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Emergency Contact Phone</label>
          {isEditingProfile ? (
            <input
              type="text"
              value={profileForm.emergency_contact_phone}
              onChange={e => setProfileForm({ ...profileForm, emergency_contact_phone: e.target.value })}
              className="form-input"
            />
          ) : (
            <div className="form-input" style={{ backgroundColor: '#f8fafc' }}>{patientProfile.emergency_contact_phone || 'Not set'}</div>
          )}
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Allergies</label>
          {isEditingProfile ? (
            <textarea
              rows={2}
              value={profileForm.allergies}
              onChange={e => setProfileForm({ ...profileForm, allergies: e.target.value })}
              className="form-input"
              placeholder="List any known allergies (e.g. Penicillin, Latex)"
            />
          ) : (
            <div className="form-input" style={{ backgroundColor: '#f8fafc' }}>{patientProfile.allergies || 'No known allergies'}</div>
          )}
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', color: '#64748b' }}>Chronic Conditions</label>
          {isEditingProfile ? (
            <textarea
              rows={2}
              value={profileForm.chronic_conditions}
              onChange={e => setProfileForm({ ...profileForm, chronic_conditions: e.target.value })}
              className="form-input"
              placeholder="List any ongoing medical conditions (e.g. Diabetes, Hypertension)"
            />
          ) : (
            <div className="form-input" style={{ backgroundColor: '#f8fafc' }}>{patientProfile.chronic_conditions || 'None reported'}</div>
          )}
        </div>
      </div>
    </div>
  );
};
