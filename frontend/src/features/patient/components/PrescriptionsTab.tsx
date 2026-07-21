import React from 'react';
import { Pill, Download } from 'lucide-react';

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
  if (!dashboardData) return null;

  return (
    <div className="card">
      <div className="card-title-bar">
        <h3 className="card-title"><Pill size={18} /> Prescriptions</h3>
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
            {dashboardData.prescriptions?.map((rx: any) => {
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
            {(!dashboardData.prescriptions || dashboardData.prescriptions.length === 0) && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No prescriptions issued.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
