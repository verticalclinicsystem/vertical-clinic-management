import React, { useState } from 'react';
import { 
  Stethoscope, 
  Pill, 
  CalendarRange, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Eye, 
  Calendar,
  Sparkles,
  ArrowRight,
  Activity,
  MapPin
} from 'lucide-react';

interface TimelineTabProps {
  timeline: any[];
  dashboardData: any;
  followups: any[];
  handleBookFollowup: (followup: any) => void;
  setViewingHistoryEvent: (event: any) => void;
  setViewingInvoice?: (invoice: any) => void;
  setViewingReport?: (report: any) => void;
}

export const TimelineTab: React.FC<TimelineTabProps> = ({
  timeline,
  followups,
  handleBookFollowup,
  setViewingHistoryEvent,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'with_meds' | 'followup'>('all');
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const formatEventDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  const formatEventTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch {
      return '';
    }
  };

  // Filter only clinical events (visits, clinical prescriptions, follow-ups) — excluding invoices & raw reports
  const clinicalTimeline = React.useMemo(() => {
    const seen = new Set<string>();
    return (timeline || [])
      .filter((event: any) => {
        // Exclude invoices and raw report file uploads
        if (event.event_type === 'invoice' || event.event_type === 'report') {
          return false;
        }
        const key = `${event.event_type}-${event.title}-${event.datetime}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [timeline]);

  const filteredTimeline = clinicalTimeline.filter((event: any) => {
    // Filter logic
    if (activeFilter === 'with_meds') {
      const meds = event.details?.medicines || [];
      if (meds.length === 0) return false;
    } else if (activeFilter === 'followup') {
      if (event.event_type !== 'followup' && event.event_type !== 'follow_up' && !event.details?.followup_advised) {
        return false;
      }
    }

    // Search query logic
    if (searchTerm) {
      const cleanTerm = searchTerm.toLowerCase();
      const title = (event.title || '').toLowerCase();
      const doctor = (event.details?.doctor_name || '').toLowerCase();
      const diagnosis = (event.details?.diagnosis || '').toLowerCase();
      const symptoms = (event.details?.symptoms || '').toLowerCase();
      const meds = (event.details?.medicines || []).map((m: any) => (m.name || '').toLowerCase()).join(' ');
      
      const matched = title.includes(cleanTerm) || 
                      doctor.includes(cleanTerm) || 
                      diagnosis.includes(cleanTerm) || 
                      symptoms.includes(cleanTerm) || 
                      meds.includes(cleanTerm);
      if (!matched) return false;
    }

    return true;
  });

  const areAllExpanded = filteredTimeline.length > 0 && filteredTimeline.every((event: any, idx: number) => {
    const key = `${event.event_type}-${event.datetime}-${idx}`;
    return Boolean(expandedKeys[key]);
  });

  const toggleExpandAll = () => {
    if (areAllExpanded) {
      setExpandedKeys({});
    } else {
      const all: Record<string, boolean> = {};
      filteredTimeline.forEach((event: any, idx: number) => {
        const key = `${event.event_type}-${event.datetime}-${idx}`;
        all[key] = true;
      });
      setExpandedKeys(all);
    }
  };

  return (
    <div className="card timeline-card-container">
      <div className="card-title-bar timeline-header-bar">
        <h3 className="card-title">
          <Stethoscope size={20} className="pulse-icon" /> Doctor Visits &amp; Medical History
        </h3>
        <p className="card-subtitle">
          A clinical record of your past doctor visits, diagnoses, and prescribed treatments
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="timeline-filter-bar">
        <div className="timeline-search-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search doctor, diagnosis, symptoms, or medicines..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="timeline-search-input"
          />
        </div>

        <div className="timeline-pills" style={{ display: 'flex', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '8px' }}>
          <button 
            className={`timeline-pill-btn all ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All Visits ({clinicalTimeline.length})
          </button>
          <button 
            className={`timeline-pill-btn prescription ${activeFilter === 'with_meds' ? 'active' : ''}`}
            onClick={() => setActiveFilter('with_meds')}
          >
            <Pill size={13} /> With Prescriptions
          </button>
          <button 
            className={`timeline-pill-btn followup ${activeFilter === 'followup' ? 'active' : ''}`}
            onClick={() => setActiveFilter('followup')}
          >
            <CalendarRange size={13} /> Follow-ups
          </button>

          {filteredTimeline.length > 0 && (
            <button
              type="button"
              className="timeline-pill-btn"
              onClick={toggleExpandAll}
              style={{
                marginLeft: 'auto',
                backgroundColor: '#f8fafc',
                borderColor: '#cbd5e1',
                color: '#475569',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {areAllExpanded ? 'Collapse All ⌃' : 'Expand All ⌄'}
            </button>
          )}
        </div>
      </div>

      {filteredTimeline.length > 0 ? (
        <div className="timeline-journey-wrapper">
          <div className="timeline-track-line" />
          <div className="timeline-list-premium">
            {filteredTimeline.map((event: any, idx: number) => {
              const eventKey = `${event.event_type}-${event.datetime}-${idx}`;
              const isExpanded = Boolean(expandedKeys[eventKey]); // Pattern B: Collapsed by default!
              const isVisit = event.event_type === 'visit';
              const isFollowup = event.event_type === 'followup' || event.event_type === 'follow_up';
              const medicines = event.details?.medicines || [];

              return (
                <div 
                  key={eventKey}
                  className={`timeline-item-premium ${isFollowup ? 'followup-theme' : 'visit-theme'} ${isExpanded ? 'expanded' : 'collapsed'}`}
                >
                  {/* Left Date Column */}
                  <div className="timeline-time-col">
                    <span className="event-date-main">{formatEventDate(event.datetime)}</span>
                    <span className="event-time-sub">{formatEventTime(event.datetime)}</span>
                  </div>

                  {/* Marker Icon */}
                  <div className="timeline-marker-premium">
                    <div className="timeline-icon-badge">
                      {isFollowup ? <CalendarRange size={18} /> : <Stethoscope size={18} />}
                    </div>
                  </div>

                  {/* Visit Card (Single-line strip when collapsed) */}
                  <div 
                    className="timeline-card-premium"
                    style={{ 
                      cursor: 'pointer',
                      padding: isExpanded ? '16px 20px' : '12px 18px',
                      transition: 'all 0.2s ease',
                      backgroundColor: isExpanded ? '#ffffff' : '#fcfcfd'
                    }}
                    onClick={() => toggleExpand(eventKey)}
                  >
                    {/* Header Strip */}
                    <div 
                      className="timeline-card-header"
                      style={{ 
                        margin: 0, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        gap: '12px' 
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
                        <span className="event-badge" style={{ margin: 0, flexShrink: 0 }}>
                          {isFollowup ? 'Follow-Up' : 'Consultation'}
                        </span>

                        <h4 className="event-title" style={{ margin: 0, fontSize: '0.96rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap' }}>
                          {event.title}
                        </h4>

                        {event.details?.specialization && (
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: '#0369a1',
                            backgroundColor: '#e0f2fe',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            flexShrink: 0
                          }}>
                            {event.details.specialization}
                          </span>
                        )}

                        {event.details?.branch_name && (
                          <span style={{
                            fontSize: '0.72rem',
                            color: '#64748b',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            flexShrink: 0
                          }}>
                            <MapPin size={11} /> {event.details.branch_name}
                          </span>
                        )}

                        {/* Primary Diagnosis Tag on single line */}
                        {isVisit && event.details?.diagnosis && (
                          <span style={{
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            color: '#166534',
                            backgroundColor: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            padding: '2px 9px',
                            borderRadius: '6px',
                            maxWidth: '260px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'inline-block'
                          }} title={`Diagnosis: ${event.details.diagnosis}`}>
                            {event.details.diagnosis}
                          </span>
                        )}

                        {/* Prescribed Meds Quick Tag */}
                        {isVisit && (
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: medicines.length > 0 ? '#0f766e' : '#64748b',
                            backgroundColor: medicines.length > 0 ? '#f0fdfa' : '#f1f5f9',
                            border: `1px solid ${medicines.length > 0 ? '#ccfbf1' : '#e2e8f0'}`,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            flexShrink: 0
                          }}>
                            <Pill size={11} color={medicines.length > 0 ? '#0d9488' : '#94a3b8'} />
                            {medicines.length > 0 ? `${medicines.length} Meds` : 'No Meds'}
                          </span>
                        )}

                        {/* Vitals Quick Tag */}
                        {isVisit && (event.details?.vitals_bp || event.details?.vitals_pulse) && (
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: '#0369a1',
                            backgroundColor: '#f0f9ff',
                            border: '1px solid #bae6fd',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            flexShrink: 0
                          }}>
                            <Activity size={11} color="#0284c7" /> Vitals
                          </span>
                        )}

                        {/* Follow-up Quick Tag */}
                        {isFollowup && (
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            color: '#db2777',
                            backgroundColor: '#fdf2f8',
                            border: '1px solid #fbcfe8',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            flexShrink: 0
                          }}>
                            Follow-Up Advised
                          </span>
                        )}
                      </div>

                      {/* Right Action buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {isVisit && (
                          <button
                            type="button"
                            className="expand-toggle-btn"
                            title="View Full Consultation Modal"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingHistoryEvent(event);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              color: '#475569',
                              backgroundColor: '#f1f5f9',
                              border: '1px solid #e2e8f0',
                              padding: '4px 8px',
                              borderRadius: '6px'
                            }}
                          >
                            <Eye size={13} />
                          </button>
                        )}

                        <button 
                          className="expand-toggle-btn"
                          onClick={(e) => toggleExpand(eventKey, e)}
                          aria-label={isExpanded ? "Collapse details" : "Expand details"}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            color: '#0284c7',
                            backgroundColor: '#f0f9ff',
                            border: '1px solid #e0f2fe',
                            padding: '4px 10px',
                            borderRadius: '6px'
                          }}
                        >
                          <span>{isExpanded ? 'Less' : 'Details'}</span>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Content: Symptoms, Medicines, Vitals */}
                    {isExpanded && (
                      <div className="timeline-card-expanded" onClick={(e) => e.stopPropagation()} style={{ marginTop: '12px' }}>
                        <div className="expanded-divider" />

                        {isVisit && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {/* Full Diagnosis */}
                            {event.details?.diagnosis && (
                              <div style={{
                                padding: '10px 14px',
                                backgroundColor: '#f0fdf4',
                                border: '1.5px solid #bbf7d0',
                                borderRadius: '8px',
                                color: '#166534',
                                fontSize: '0.9rem',
                                fontWeight: 700
                              }}>
                                Diagnosis: {event.details.diagnosis}
                              </div>
                            )}
                            {/* Symptoms */}
                            {event.details?.symptoms && (
                              <div style={{ backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                                  Chief Symptoms Reported
                                </span>
                                <p style={{ margin: '2px 0 0', fontSize: '0.86rem', color: '#334155' }}>
                                  {event.details.symptoms}
                                </p>
                              </div>
                            )}

                            {/* Prescribed Medications */}
                            {medicines.length > 0 ? (
                              <div style={{
                                backgroundColor: '#f0fdfa',
                                border: '1.5px solid #ccfbf1',
                                borderRadius: '10px',
                                padding: '12px 14px'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                  <Pill size={15} color="#0d9488" />
                                  <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', color: '#0f766e', letterSpacing: '0.5px' }}>
                                    Medicines Prescribed ({medicines.length})
                                  </span>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {medicines.map((med: any, mIdx: number) => (
                                    <div key={mIdx} style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      backgroundColor: '#ffffff',
                                      padding: '8px 12px',
                                      borderRadius: '8px',
                                      border: '1px solid #99f6e4',
                                      flexWrap: 'wrap',
                                      gap: '8px'
                                    }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{
                                          width: '26px',
                                          height: '26px',
                                          borderRadius: '6px',
                                          backgroundColor: '#ccfbf1',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          color: '#0d9488',
                                          fontSize: '0.8rem',
                                          fontWeight: 700
                                        }}>
                                          Rx
                                        </div>
                                        <div>
                                          <strong style={{ fontSize: '0.88rem', color: '#0f766e' }}>
                                            {med.name}
                                          </strong>
                                          {med.instructions && (
                                            <span style={{ fontSize: '0.76rem', color: '#64748b', display: 'block' }}>
                                              {med.instructions}
                                            </span>
                                          )}
                                        </div>
                                      </div>

                                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        {med.dosage && (
                                          <span style={{
                                            fontSize: '0.75rem',
                                            backgroundColor: '#f0fdfa',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            border: '1px solid #99f6e4',
                                            color: '#0f766e',
                                            fontWeight: 600
                                          }}>
                                            {med.dosage}
                                          </span>
                                        )}
                                        {med.duration && (
                                          <span style={{
                                            fontSize: '0.75rem',
                                            backgroundColor: '#f1f5f9',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            color: '#475569',
                                            fontWeight: 600
                                          }}>
                                            {med.duration}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic' }}>
                                No medications prescribed for this visit.
                              </div>
                            )}

                            {/* Vitals Recorded */}
                            {(event.details?.vitals_bp || event.details?.vitals_pulse || event.details?.vitals_temperature) && (
                              <div style={{
                                display: 'flex',
                                gap: '16px',
                                alignItems: 'center',
                                fontSize: '0.8rem',
                                color: '#475569',
                                backgroundColor: '#f8fafc',
                                padding: '8px 12px',
                                borderRadius: '8px',
                                flexWrap: 'wrap'
                              }}>
                                <span style={{ fontWeight: 700, color: '#334155', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <Activity size={13} color="#0284c7" /> Recorded Vitals:
                                </span>
                                {event.details.vitals_bp && <span>BP: <strong>{event.details.vitals_bp} mmHg</strong></span>}
                                {event.details.vitals_pulse && <span>Pulse: <strong>{event.details.vitals_pulse} bpm</strong></span>}
                                {event.details.vitals_temperature && <span>Temp: <strong>{event.details.vitals_temperature} °F</strong></span>}
                              </div>
                            )}

                            {/* Doctor Notes */}
                            {event.details?.notes && (
                              <div className="detail-row">
                                <span className="detail-label">Doctor's Clinical Notes</span>
                                <p className="detail-val note-bubble">{event.details.notes}</p>
                              </div>
                            )}

                            <button 
                              type="button"
                              className="timeline-action-btn"
                              onClick={() => setViewingHistoryEvent(event)}
                              style={{ alignSelf: 'flex-start', marginTop: '4px' }}
                            >
                              <Eye size={14} /> View Full Consultation Summary
                            </button>
                          </div>
                        )}

                        {isFollowup && (
                          <div className="expanded-followup-details">
                            <div className="followup-alert-box">
                              <Sparkles size={16} className="sparkle-icon" />
                              <div className="followup-text">
                                Recommended follow-up date: <strong>{formatEventDate(event.datetime)}</strong>
                              </div>
                            </div>
                            <p className="followup-notes">{event.details?.notes}</p>
                            
                            {event.details?.status !== 'booked' && (
                              <button 
                                className="timeline-action-btn success"
                                onClick={() => {
                                  const found = followups.find(f => String(f.consultation_id) === String(event.details?.consultation_id));
                                  if (found) {
                                    handleBookFollowup(found);
                                  } else {
                                    handleBookFollowup({
                                      doctor_id: event.details?.doctor_id,
                                      doctor_name: event.details?.doctor_name || event.title?.replace('Follow-up Recommended with ', '') || 'Doctor',
                                      recommended_date: event.datetime,
                                      treatment_type: event.details?.treatment_type || 'Follow-up',
                                      notes: event.details?.notes
                                    });
                                  }
                                }}
                              >
                                Book Follow-up Appointment <ArrowRight size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="timeline-empty-state">
          <Calendar size={48} className="empty-icon" />
          <h4>No doctor visits match your filter</h4>
          <p>Your past clinic visits and consultations will appear here automatically.</p>
          {(searchTerm || activeFilter !== 'all') && (
            <button 
              className="btn-secondary"
              onClick={() => {
                setSearchTerm('');
                setActiveFilter('all');
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TimelineTab;
