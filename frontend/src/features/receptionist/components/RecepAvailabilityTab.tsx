import React from 'react';
import { Calendar, Clock, Plus } from 'lucide-react';

interface RecepAvailabilityTabProps {
  setIsRequestingChange: (requesting: boolean) => void;
  branches: any[];
  selectedBranchId: any;
  myRequests: any[];
}

export const RecepAvailabilityTab: React.FC<RecepAvailabilityTabProps> = ({
  setIsRequestingChange,
  branches,
  selectedBranchId,
  myRequests,
}) => {
  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px 0', width: '100%' }}>
      {/* Top Banner Accent */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f766e 0%, #0d9488 100%)',
          color: '#ffffff',
          padding: '24px 28px',
          borderRadius: '12px',
          marginBottom: '24px',
          boxShadow: '0 4px 12px rgba(15, 118, 110, 0.08)',
        }}
      >
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Calendar size={22} /> Availability & Schedule Settings
        </h2>
        <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: '#ccfbf1', lineHeight: 1.4, opacity: 0.9 }}>
          Your shift timings are synchronized with branch operating parameters. If you need to take leaves, please click{' '}
          <strong>Request Leave</strong> to submit a leave application to the clinic admin for approval.
        </p>
        <div style={{ marginTop: '16px' }}>
          <button
            onClick={() => setIsRequestingChange(true)}
            style={{
              backgroundColor: '#ffffff',
              color: '#0f766e',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            <Plus size={16} /> Request Leave
          </button>
        </div>
      </div>

      {/* Read-only availability parameters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        {/* Working Hours Card */}
        <div
          className="recep-card"
          style={{
            padding: '24px',
            marginBottom: 0,
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
            border: '1px solid #bbf7d0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'default',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow =
              '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow =
              '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                backgroundColor: '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={20} color="#16a34a" />
            </div>
            <span style={{ fontSize: '1rem', fontWeight: '700', color: '#14532d' }}>Working Hours</span>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: '500', marginBottom: '4px' }}>Daily Shift Hours</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#15803d', letterSpacing: '-0.5px' }}>
              {(() => {
                const userBranch = branches.find((b) => b.id === selectedBranchId) || branches[0];
                const formatHour = (timeStr: string) => {
                  if (!timeStr) return '';
                  return timeStr.slice(0, 5);
                };
                const start = userBranch ? formatHour(userBranch.opening_hour) : '09:00';
                const end = userBranch ? formatHour(userBranch.closing_hour) : '21:00';
                return `${start} - ${end}`;
              })()}
            </div>
          </div>
        </div>

        {/* Operational Breaks Card */}
        <div
          className="recep-card"
          style={{
            padding: '24px',
            marginBottom: 0,
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)',
            border: '1px solid #fde68a',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'default',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow =
              '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow =
              '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                backgroundColor: '#fef3c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Clock size={20} color="#d97706" />
            </div>
            <span style={{ fontSize: '1rem', fontWeight: '700', color: '#78350f' }}>Operational Breaks</span>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: '#92400e', fontWeight: '500', marginBottom: '4px' }}>Daily Lunch Break</div>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#b45309', letterSpacing: '-0.5px' }}>13:00 - 14:00</div>
          </div>
        </div>
      </div>

      {/* Leave Requests History */}
      <div className="recep-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--recep-text-dark)', marginBottom: '12px' }}>
          Leave Requests History
        </h3>
        {myRequests.length === 0 ? (
          <p style={{ fontSize: '0.85rem', color: 'var(--recep-text-muted)', margin: 0 }}>
            You have not submitted any leave requests yet.
          </p>
        ) : (
          <div className="recep-table-container" style={{ margin: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--recep-border)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 8px' }}>Type</th>
                  <th style={{ padding: '10px 8px' }}>Requested Dates</th>
                  <th style={{ padding: '10px 8px' }}>Reason</th>
                  <th style={{ padding: '10px 8px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {myRequests.map((req: any) => {
                  const propStr = `${req.proposed_start_date} to ${req.proposed_end_date}`;
                  return (
                    <tr key={req.id} style={{ borderBottom: '1px solid var(--recep-border)' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 600 }}>Leave</td>
                      <td style={{ padding: '12px 8px' }}>{propStr}</td>
                      <td style={{ padding: '12px 8px' }}>{req.reason}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            backgroundColor:
                              req.status === 'approved' ? '#dcfce7' : req.status === 'rejected' ? '#fee2e2' : '#fef3c7',
                            color:
                              req.status === 'approved' ? '#15803d' : req.status === 'rejected' ? '#b91c1c' : '#b45309',
                          }}
                        >
                          {req.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
