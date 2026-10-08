import React from 'react';
import { User, ShieldCheck, Lock, AlertTriangle, Info } from 'lucide-react';

interface ProfileTabProps {
  patientProfile: any;
  isEditingProfile: boolean;
  setIsEditingProfile: (editing: boolean) => void;
  profileForm: any;
  setProfileForm: (form: any) => void;
  startEditingProfile: () => void;
  handleSaveProfile: (e: React.FormEvent) => void;
  getInitials?: (name?: string) => string;
  onOpenProfileWizard?: () => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  patientProfile,
  isEditingProfile,
  setIsEditingProfile,
  profileForm,
  setProfileForm,
  startEditingProfile,
  handleSaveProfile,
  onOpenProfileWizard,
}) => {
  if (!patientProfile) return null;

  // Helper to parse chronic conditions JSON
  const getChronicConditionVal = (key: string) => {
    try {
      if (patientProfile.chronic_conditions) {
        const parsed = JSON.parse(patientProfile.chronic_conditions);
        return parsed[key] || 'None';
      }
    } catch (e) {
      if (key === 'chronicDiseases') {
        return patientProfile.chronic_conditions || 'None';
      }
    }
    return 'None';
  };

  const calculateAge = (dobString?: string): string => {
    if (!dobString) return '';
    const birthDate = new Date(dobString);
    if (isNaN(birthDate.getTime())) return '';
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age > 0 ? `${age} Yrs` : '< 1 Yr';
  };

  const hasAllergies = patientProfile.allergies && 
    patientProfile.allergies.toLowerCase() !== 'none' && 
    patientProfile.allergies.toLowerCase() !== 'no known allergies';

  const chronicDiseases = getChronicConditionVal('chronicDiseases');
  const hasChronicDiseases = chronicDiseases && chronicDiseases.toLowerCase() !== 'none';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* ── SECTION 1: PERSONAL & CONTACT INFORMATION (EDITABLE) ── */}
      <div className="card">
        <div className="card-title-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <User size={18} /> Personal & Contact Details
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Manage your phone number, current vitals, and emergency contact details.
            </p>
          </div>

          {!isEditingProfile ? (
            <button
              onClick={startEditingProfile}
              className="btn-secondary"
              style={{ padding: '7px 14px', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              ✏️ Edit Contact Details
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setIsEditingProfile(false)}
                className="btn-secondary"
                style={{ padding: '7px 14px', fontSize: '0.85rem', fontWeight: 600 }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfile}
                className="btn-primary"
                style={{ padding: '7px 16px', fontSize: '0.85rem', fontWeight: 600 }}
              >
                Save Changes
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '18px', marginTop: '18px' }}>
          <div>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.78rem', color: '#64748b' }}>
              Full Name
            </label>
            <div className="form-input" style={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#334155' }}>
              {patientProfile.user?.full_name} <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: '6px' }}>🔒 System Record</span>
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.78rem', color: '#64748b' }}>
              Email Address
            </label>
            <div className="form-input" style={{ backgroundColor: '#f8fafc', color: '#334155' }}>
              {patientProfile.user?.email} <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: '6px' }}>🔒 Account Email</span>
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.78rem', color: '#64748b' }}>
              Patient ID Code
            </label>
            <div className="form-input" style={{ backgroundColor: '#f8fafc', fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary, #0284c7)' }}>
              {patientProfile.patient_code}
            </div>
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.78rem', color: '#64748b' }}>
              Phone Number {isEditingProfile && <span style={{ color: 'var(--primary, #0284c7)' }}>*</span>}
            </label>
            {isEditingProfile ? (
              <input
                type="text"
                value={profileForm.phone || ''}
                onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                className="form-input"
                placeholder="+91..."
              />
            ) : (
              <div className="form-input" style={{ backgroundColor: '#f8fafc' }}>{patientProfile.user?.phone || 'Not set'}</div>
            )}
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.78rem', color: '#64748b' }}>
              Height (cm)
            </label>
            {isEditingProfile ? (
              <input
                type="text"
                value={profileForm.height || ''}
                onChange={e => setProfileForm({ ...profileForm, height: e.target.value })}
                className="form-input"
                placeholder="e.g. 175"
              />
            ) : (
              <div className="form-input" style={{ backgroundColor: '#f8fafc' }}>
                {patientProfile.height ? `${patientProfile.height} cm` : 'Not recorded'}
              </div>
            )}
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.78rem', color: '#64748b' }}>
              Weight (kg)
            </label>
            {isEditingProfile ? (
              <input
                type="text"
                value={profileForm.weight || ''}
                onChange={e => setProfileForm({ ...profileForm, weight: e.target.value })}
                className="form-input"
                placeholder="e.g. 70"
              />
            ) : (
              <div className="form-input" style={{ backgroundColor: '#f8fafc' }}>
                {patientProfile.weight ? `${patientProfile.weight} kg` : 'Not recorded'}
              </div>
            )}
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.78rem', color: '#64748b' }}>
              Emergency Contact Name
            </label>
            {isEditingProfile ? (
              <input
                type="text"
                value={profileForm.emergency_contact_name || ''}
                onChange={e => setProfileForm({ ...profileForm, emergency_contact_name: e.target.value })}
                className="form-input"
                placeholder="e.g. Spouse / Parent"
              />
            ) : (
              <div className="form-input" style={{ backgroundColor: '#f8fafc' }}>{patientProfile.emergency_contact_name || 'Not set'}</div>
            )}
          </div>

          <div>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.78rem', color: '#64748b' }}>
              Emergency Contact Phone
            </label>
            {isEditingProfile ? (
              <input
                type="text"
                value={profileForm.emergency_contact_phone || ''}
                onChange={e => setProfileForm({ ...profileForm, emergency_contact_phone: e.target.value })}
                className="form-input"
                placeholder="e.g. +91..."
              />
            ) : (
              <div className="form-input" style={{ backgroundColor: '#f8fafc' }}>{patientProfile.emergency_contact_phone || 'Not set'}</div>
            )}
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label className="form-label" style={{ fontWeight: 600, fontSize: '0.78rem', color: '#64748b' }}>
              Residential Address
            </label>
            {isEditingProfile ? (
              <input
                type="text"
                value={profileForm.address || ''}
                onChange={e => setProfileForm({ ...profileForm, address: e.target.value })}
                className="form-input"
                placeholder="Street address, City, Pincode"
              />
            ) : (
              <div className="form-input" style={{ backgroundColor: '#f8fafc' }}>{patientProfile.address || 'Not set'}</div>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 2: VERIFIED CLINICAL RECORD & MEDICAL ALERTS (🔒 LOCKED) ── */}
      <div className="card" style={{ border: '1.5px solid #e2e8f0' }}>
        <div className="card-title-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#0f172a' }}>
              <ShieldCheck size={20} color="#059669" /> Verified Clinical Profile & Medical Alerts
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
              Permanent baseline medical record used by doctors during consultations and prescriptions.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.75rem',
              fontWeight: 700,
              padding: '4px 10px',
              borderRadius: '8px',
              backgroundColor: '#f1f5f9',
              color: '#475569',
              border: '1px solid #cbd5e1',
            }}>
              <Lock size={12} /> Staff Supervised Record
            </span>

            {!patientProfile.is_profile_completed && onOpenProfileWizard && (
              <button
                onClick={onOpenProfileWizard}
                className="btn-primary"
                style={{ padding: '6px 14px', fontSize: '0.82rem', fontWeight: 700, backgroundColor: '#d97706', borderColor: '#d97706' }}
              >
                📋 Complete First-Time Wizard →
              </button>
            )}
          </div>
        </div>

        {/* Safety Explanatory Notice */}
        <div style={{
          margin: '14px 0 20px',
          padding: '12px 16px',
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}>
          <Info size={18} color="#0284c7" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '0.82rem', color: '#0369a1', lineHeight: '1.45' }}>
            <strong>Why are these fields locked?</strong> For your medical safety, Blood Group, Age, Allergies, and Chronic Conditions cannot be modified directly online to prevent prescription and medication errors. To amend these records, please notify your doctor during consultation or inform front-desk staff during your clinic visit.
          </div>
        </div>

        {/* Clinical Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          {/* Blood Group */}
          <div style={{
            padding: '14px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
                🩸 Blood Group
              </span>
              <Lock size={13} color="#94a3b8" />
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#dc2626' }}>
              {patientProfile.blood_group || <span style={{ fontSize: '0.88rem', fontWeight: 500, color: '#94a3b8' }}>Pending Intake</span>}
            </div>
            <span style={{ fontSize: '0.72rem', color: '#64748b' }}>Permanent biological record</span>
          </div>

          {/* Date of Birth & Calculated Age */}
          <div style={{
            padding: '14px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px' }}>
                📅 Date of Birth
              </span>
              <Lock size={13} color="#94a3b8" />
            </div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>
              {patientProfile.date_of_birth ? new Date(patientProfile.date_of_birth).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set'}
            </div>
            <span style={{ fontSize: '0.72rem', color: '#0284c7', fontWeight: 600 }}>
              Calculated Age: {calculateAge(patientProfile.date_of_birth) || '--'}
            </span>
          </div>

          {/* Known Allergies */}
          <div style={{
            gridColumn: '1 / -1',
            padding: '16px',
            backgroundColor: hasAllergies ? '#fef2f2' : '#f0fdf4',
            border: `1.5px solid ${hasAllergies ? '#fecaca' : '#bbf7d0'}`,
            borderRadius: '12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{
                fontSize: '0.78rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                color: hasAllergies ? '#b91c1c' : '#166534',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <AlertTriangle size={15} color={hasAllergies ? '#dc2626' : '#16a34a'} />
                Known Drug & Food Allergies
              </span>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: hasAllergies ? '#fee2e2' : '#dcfce7',
                color: hasAllergies ? '#991b1b' : '#15803d',
              }}>
                {hasAllergies ? '⚠️ High Attention' : '✓ Safe'}
              </span>
            </div>
            <div style={{
              fontSize: '0.96rem',
              fontWeight: 700,
              color: hasAllergies ? '#991b1b' : '#14532d',
              marginTop: '4px',
            }}>
              {patientProfile.allergies || 'No known allergies recorded'}
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '0.74rem', color: hasAllergies ? '#b91c1c' : '#166534' }}>
              Checked automatically against prescription drug contraindications.
            </p>
          </div>

          {/* Chronic Diseases */}
          <div style={{
            padding: '14px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                🩺 Chronic Diseases
              </span>
              <Lock size={12} color="#94a3b8" />
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: hasChronicDiseases ? '#92400e' : '#334155' }}>
              {chronicDiseases}
            </div>
          </div>

          {/* High Risk Flags */}
          <div style={{
            padding: '14px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                ❤️ High Risk Flags
              </span>
              <Lock size={12} color="#94a3b8" />
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>
              {getChronicConditionVal('highRiskFlags')}
            </div>
          </div>

          {/* Special Condition */}
          <div style={{
            padding: '14px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                🤰 Special Condition
              </span>
              <Lock size={12} color="#94a3b8" />
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>
              {getChronicConditionVal('specialCondition')}
            </div>
          </div>

          {/* Disability */}
          <div style={{
            padding: '14px',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                ♿ Disability
              </span>
              <Lock size={12} color="#94a3b8" />
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>
              {getChronicConditionVal('disability')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileTab;
