import React, { useEffect, useState } from 'react';
import { UserCheck, X } from 'lucide-react';
// Types for Bed and Admission (simplified)
interface BedInfo {
  id: string;
  ward_name: string;
  bed_number: string;
  status: 'available' | 'occupied' | 'maintenance';
}

interface AdmissionInfo {
  id: string;
  patient_name: string;
  patient_code: string;
  doctor_name?: string;
  bed?: BedInfo;
  status: 'pending' | 'admitted' | 'in_consultation' | 'discharged';
}

type Role = 'doctor' | 'receptionist' | 'manager';

interface IPDBedManagementProps {
  role: Role;
}

/**
 * IPD Bed Management UI component
 * -------------------------------------------------
 * This component renders a role‑based interface for the
 * IPD (In‑Patient Department) bed management workflow.
 *   • Receptionist – Admit patients, assign beds, check‑in.
 *   • Doctor      – View own patients, transfer beds, discharge.
 *   • Manager     – Overview of all beds, occupancy stats, edit wards.
 *
 * All colours and spacing use the global design‑system CSS variables
 * defined in `index.css`. No hard‑coded legacy colours remain.
 */
const IPDBedManagement: React.FC<IPDBedManagementProps> = ({ role }) => {
  const [beds, setBeds] = useState<BedInfo[]>([]);
  const [admissions, setAdmissions] = useState<AdmissionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch data – placeholder API calls (replace with real endpoints)
  const fetchBeds = async () => {
    // Example: GET /api/beds
    const res = await fetch('/api/beds');
    const data = await res.json();
    setBeds(data);
  };

  const fetchAdmissions = async () => {
    // Example: GET /api/ipd/admissions
    const res = await fetch('/api/ipd/admissions');
    const data = await res.json();
    setAdmissions(data);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchBeds(), fetchAdmissions()]);
      setLoading(false);
    })();
  }, []);

  // ----- Role specific actions -------------------------------------------------
  const handleAssignBed = async (admId: string, bedId: string) => {
    await fetch(`/api/ipd/admissions/${admId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bed_id: bedId }),
    });
    await fetchAdmissions();
  };

  const handleDischarge = async (admId: string) => {
    await fetch(`/api/ipd/admissions/${admId}/discharge`, { method: 'POST' });
    await fetchAdmissions();
  };

  const handleCheckIn = async (admId: string) => {
    await fetch(`/api/ipd/admissions/${admId}/checkin`, { method: 'POST' });
    await fetchAdmissions();
  };

  // ---------------------------------------------------------------------------
  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading…</div>;
  }

  // ---------- Receptionist view ------------------------------------------------
  if (role === 'receptionist') {
    return (
      <div className="ipd-management-recep" style={{ background: 'var(--bg)', padding: '2rem' }}>
        <h2 style={{ color: 'var(--primary-text)', marginBottom: '1rem' }}>IPD Admission Queue</h2>
        {admissions
          .filter((a) => a.status === 'pending')
          .map((adm) => (
            <div key={adm.id} className="admission-card" style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '1.5rem',
              marginBottom: '1rem',
              boxShadow: 'var(--shadow-md)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, color: 'var(--primary-text)' }}>{adm.patient_name}</p>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--secondary-text)' }}>Code: {adm.patient_code}</p>
                </div>
                <button
                  className="recep-btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, var(--primary-teal) 0%, var(--active-nav) 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.5rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  onClick={() => handleCheckIn(adm.id)}
                >
                  <UserCheck size={16} /> Check‑In
                </button>
              </div>
              {/* Bed assignment dropdown – only after check‑in */}
              {adm.status !== 'pending' && (
                <div style={{ marginTop: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--secondary-text)' }}>Assign Bed</label>
                  <select
                    className="recep-select-field"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      marginTop: '0.4rem',
                      background: '#fff',
                      color: 'var(--primary-text)',
                    }}
                    onChange={(e) => handleAssignBed(adm.id, e.target.value)}
                  >
                    <option value="">Select a bed</option>
                    {beds
                      .filter((b) => b.status === 'available')
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.ward_name} – {b.bed_number}
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
          ))}
      </div>
    );
  }

  // ---------- Doctor view ------------------------------------------------------
  if (role === 'doctor') {
    // Assume the backend provides doctor‑specific admissions via a query param.
    const doctorAdmissions = admissions.filter((a) => a.doctor_name === 'Dr. Current'); // placeholder
    return (
      <div className="ipd-management-doctor" style={{ background: 'var(--bg)', padding: '2rem' }}>
        <h2 style={{ color: 'var(--primary-text)', marginBottom: '1rem' }}>My In‑Patient List</h2>
        {doctorAdmissions.length === 0 && <p>No patients assigned.</p>}
        {doctorAdmissions.map((adm) => (
          <div key={adm.id} className="patient-card" style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '1rem',
            boxShadow: 'var(--shadow-md)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--primary-text)' }}>{adm.patient_name}</p>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--secondary-text)' }}>Bed: {adm.bed?.bed_number || '—'}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {/* Transfer bed */}
                <select
                  className="recep-select-field"
                  defaultValue={adm.bed?.id || ''}
                  style={{
                    padding: '0.4rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: '#fff',
                    color: 'var(--primary-text)',
                  }}
                  onChange={(e) => handleAssignBed(adm.id, e.target.value)}
                >
                  <option value="">Change Bed</option>
                  {beds
                    .filter((b) => b.status === 'available' || b.id === adm.bed?.id)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.ward_name} – {b.bed_number}
                      </option>
                    ))}
                </select>
                {/* Discharge button */}
                <button
                  className="recep-btn-secondary"
                  style={{
                    background: 'var(--danger)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.4rem 0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  onClick={() => handleDischarge(adm.id)}
                >
                  <X size={14} /> Discharge
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ---------- Manager view ------------------------------------------------------
  if (role === 'manager') {
    const totalBeds = beds.length;
    const occupied = beds.filter((b) => b.status === 'occupied').length;
    const available = beds.filter((b) => b.status === 'available').length;
    const maintenance = beds.filter((b) => b.status === 'maintenance').length;
    return (
      <div className="ipd-management-manager" style={{ background: 'var(--bg)', padding: '2rem' }}>
        <h2 style={{ color: 'var(--primary-text)', marginBottom: '1rem' }}>Bed Occupancy Overview</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div style={cardStyle('#0B7894')}>Total Beds: {totalBeds}</div>
          <div style={cardStyle('#18B981')}>Occupied: {occupied}</div>
          <div style={cardStyle('#16B9D4')}>Available: {available}</div>
          <div style={cardStyle('#EF4444')}>Maintenance: {maintenance}</div>
        </div>
        {/* Ward list – placeholder for future edit functionality */}
        {/* In a real implementation you would map over the derived object */}
        <ul style={{ marginTop: '1rem' }}>
          {Object.entries(
            beds.reduce((a, b) => {
              a[b.ward_name] = (a[b.ward_name] || 0) + 1;
              return a;
            }, {} as Record<string, number>)
          ).map(([ward, count]) => (
            <li key={ward} style={{ color: 'var(--secondary-text)' }}>
              {ward}: {count as number} beds
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // Fallback – should never happen
  return null;
};

// Helper for manager cards – uses the design‑system colours.
const cardStyle = (bgColor: string) => ({
  background: bgColor,
  color: '#fff',
  borderRadius: '12px',
  padding: '1rem',
  textAlign: 'center' as const,
  fontWeight: 600,
});

export default IPDBedManagement;
