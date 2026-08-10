import React, { useState } from 'react';
import { Pill, Download, Search } from 'lucide-react';

interface PrescriptionsTabProps {
  dashboardData: any;
  timeline: any[];
  setViewingPrescription: (rxObj: any) => void;
  downloadPdf: (url: string, filename: string) => void;
}

export const PrescriptionsTab: React.FC<PrescriptionsTabProps> = ({
  dashboardData,
  timeline,
  setViewingPrescription,
  downloadPdf,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!dashboardData) return null;

  const filteredPrescriptions = dashboardData.prescriptions?.filter((rx: any) => {
    const docName = (rx.doctor?.user?.full_name || '').toLowerCase();
    const rxItems = rx.items || rx.medications || [];
    const hasMedicine = rxItems.some((m: any) => 
      (m.medicine_name || m.name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    const consultation = rx.consultation;
    const diagnosis = (consultation?.diagnosis || rx.consultation?.diagnosis || '').toLowerCase();
    const symptoms = (consultation?.symptoms || rx.consultation?.symptoms || '').toLowerCase();

    return (
      docName.includes(searchTerm.toLowerCase()) ||
      diagnosis.includes(searchTerm.toLowerCase()) ||
      symptoms.includes(searchTerm.toLowerCase()) ||
      hasMedicine
    );
  }) || [];

  return (
    <div className="card">
      <div className="card-title-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h3 className="card-title" style={{ margin: 0 }}><Pill size={18} /> Prescriptions</h3>
        <div style={{ position: 'relative', minWidth: '240px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #64748b)' }} />
          <input
            type="text"
            placeholder="Search medicine, doctor, diagnosis..."
            list="patient-prescriptions-search-suggestions"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '6px 12px 6px 30px',
              fontSize: '0.85rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              width: '100%',
              outline: 'none',
              backgroundColor: 'var(--bg-white, #ffffff)',
              color: 'var(--text-main, #1e293b)'
            }}
          />
          <datalist id="patient-prescriptions-search-suggestions">
            {Array.from(new Set(
              (dashboardData.prescriptions || []).flatMap((rx: any) => {
                const docName = rx.doctor?.user?.full_name ? (rx.doctor.user.full_name.toLowerCase().startsWith('dr') ? rx.doctor.user.full_name : `Dr. ${rx.doctor.user.full_name}`) : '';
                const rxItems = rx.items || rx.medications || [];
                const medNames = rxItems.map((m: any) => m.medicine_name || m.name);
                const diagnosis = rx.consultation?.diagnosis || '';
                return [docName, diagnosis, ...medNames].filter(Boolean);
              })
            )).map((val: any) => (
              <option key={val} value={val} />
            ))}
          </datalist>
        </div>
      </div>
      <div className="table-container">
        <table className="portal-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Doctor</th>
              <th>Diagnosis &amp; Symptoms</th>
              <th>Prescribed Date</th>
              <th>Medications</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPrescriptions.map((rx: any) => {
              const consultation = rx.consultation;
              const diagnosis = consultation?.diagnosis
                || rx.consultation?.diagnosis
                || (() => {
                  const rxDate = new Date(rx.created_at).toDateString();
                  return timeline.find((e: any) => e.event_type === 'visit' && new Date(e.datetime).toDateString() === rxDate)?.details?.diagnosis;
                })()
                || 'General Consultation';
              const symptoms = consultation?.symptoms
                || rx.consultation?.symptoms
                || (() => {
                  const rxDate = new Date(rx.created_at).toDateString();
                  return timeline.find((e: any) => e.event_type === 'visit' && new Date(e.datetime).toDateString() === rxDate)?.details?.symptoms;
                })()
                || 'None recorded';

              return (
                <tr
                  key={rx.id}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    const target = e.target as HTMLElement;
                    if (target.tagName.toLowerCase() === 'button' || target.closest('button') || target.tagName.toLowerCase() === 'a') return;
                    setViewingPrescription({ rx, diagnosis, symptoms });
                  }}
                >
                  <td style={{ fontFamily: 'monospace' }}>{rx.id.substring(0, 8).toUpperCase()}</td>
                  <td>{rx.doctor?.user?.full_name?.toLowerCase().startsWith('dr') ? rx.doctor?.user?.full_name : `Dr. ${rx.doctor?.user?.full_name}`}</td>
                  <td>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)' }}>{diagnosis}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Symptoms: {symptoms}</div>
                  </td>
                  <td>{new Date(rx.created_at).toLocaleDateString()}</td>
                  <td>
                    <ul style={{ paddingLeft: '16px', margin: 0, fontSize: '0.8rem' }}>
                      {(rx.items || rx.medications)?.map((m: any, idx: number) => (
                        <li key={idx} style={{ color: 'var(--primary)', fontWeight: 500 }}>
                          {m.medicine_name || m.name} - {m.dosage} ({m.duration || m.duration_days + ' Days'})
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td>
                    <span className={`status-pill ${rx.status === 'active' || rx.status === 'dispensed' ? 'completed' : 'pending'}`}>
                      {rx.status}
                    </span>
                  </td>
                  <td>
                    <button
                      onClick={(e) => { e.stopPropagation(); downloadPdf(`/prescriptions/${rx.id}/pdf`, `Prescription_${rx.id.substring(0, 8)}.pdf`); }}
                      className="btn-secondary"
                      style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                    >
                      <Download size={13} /> PDF
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredPrescriptions.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  {searchTerm ? 'No matching prescriptions found.' : 'No prescriptions issued.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
