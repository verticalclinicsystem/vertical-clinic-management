import React from 'react';
import { Activity } from 'lucide-react';

interface TimelineTabProps {
  timeline: any[];
  dashboardData: any;
  setViewingHistoryEvent: (event: any) => void;
  setViewingInvoice: (invoice: any) => void;
  setViewingReport: (report: any) => void;
}

export const TimelineTab: React.FC<TimelineTabProps> = ({
  timeline,
  dashboardData,
  setViewingHistoryEvent,
  setViewingInvoice,
  setViewingReport,
}) => {
  return (
    <div className="card">
      <div className="card-title-bar">
        <h3 className="card-title"><Activity size={18} /> Medical History Timeline</h3>
      </div>
      {timeline && timeline.length > 0 ? (
        <div className="timeline-list">
          {timeline.map((event: any, idx: number) => (
            <div
              key={idx}
              className="timeline-item"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                if (event.event_type === 'visit' || event.event_type === 'prescription') {
                  setViewingHistoryEvent(event);
                } else if (event.event_type === 'invoice') {
                  const fullBill = dashboardData?.bills?.find((b: any) => b.id === event.id || b.invoice_number === event.title);
                  if (fullBill) {
                    setViewingInvoice(fullBill);
                  } else {
                    setViewingInvoice(event.details);
                  }
                } else if (event.event_type === 'report') {
                  setViewingReport(event.details);
                }
              }}
            >
              <div className={`timeline-marker ${event.event_type}`} />
              <div className="timeline-content">
                <div className="timeline-meta">
                  <span style={{ textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                    {event.event_type}
                  </span>
                  <span>{new Date(event.datetime).toLocaleDateString()}</span>
                </div>
                <span className="timeline-title">{event.title}</span>
                <div className="timeline-details">
                  {event.event_type === 'visit' && (
                    <>
                      {event.details.diagnosis && <p><strong>Diagnosis:</strong> {event.details.diagnosis}</p>}
                      {event.details.symptoms && <p><strong>Symptoms:</strong> {event.details.symptoms}</p>}
                      {event.details.notes && <p><strong>Notes:</strong> {event.details.notes}</p>}
                    </>
                  )}
                  {event.event_type === 'prescription' && (
                    <>
                      <p>Medications prescribed:</p>
                      <ul style={{ paddingLeft: '20px', marginTop: '4px' }}>
                        {(event.details.items || event.details.medications)?.map((m: any, mIdx: number) => (
                          <li key={mIdx}>{m.medicine_name || m.name} ({m.dosage}) - {m.duration || m.duration_days + ' Days'}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {event.event_type === 'invoice' && (
                    <p><strong>Amount:</strong> ₹{event.details.total_amount} | <strong>Status:</strong> {event.details.status}</p>
                  )}
                  {event.event_type === 'report' && (
                    <p><strong>Type:</strong> {event.details.report_type} | Title: {event.details.title}</p>
                  )}
                  {event.event_type === 'follow_up' && (
                    <p>{event.details.notes}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>No health events logged yet.</p>
      )}
    </div>
  );
};
