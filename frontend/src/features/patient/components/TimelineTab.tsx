import React, { useState } from 'react';
import { 
  Activity, 
  Stethoscope, 
  Pill, 
  FileText, 
  CreditCard, 
  CalendarRange, 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Download, 
  Eye, 
  Calendar,
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface TimelineTabProps {
  timeline: any[];
  dashboardData: any;
  followups: any[];
  handleBookFollowup: (followup: any) => void;
  setViewingHistoryEvent: (event: any) => void;
  setViewingInvoice: (invoice: any) => void;
  setViewingReport: (report: any) => void;
}

export const TimelineTab: React.FC<TimelineTabProps> = ({
  timeline,
  dashboardData,
  followups,
  handleBookFollowup,
  setViewingHistoryEvent,
  setViewingInvoice,
  setViewingReport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'visit' | 'prescription' | 'report' | 'invoice' | 'followup'>('all');
  const [expandedKeys, setExpandedKeys] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'visit':
        return <Stethoscope size={18} />;
      case 'prescription':
        return <Pill size={18} />;
      case 'report':
        return <FileText size={18} />;
      case 'invoice':
        return <CreditCard size={18} />;
      case 'followup':
      case 'follow_up':
        return <CalendarRange size={18} />;
      default:
        return <Activity size={18} />;
    }
  };

  const getEventColorClass = (type: string) => {
    switch (type) {
      case 'visit':
        return 'visit-theme';
      case 'prescription':
        return 'prescription-theme';
      case 'report':
        return 'report-theme';
      case 'invoice':
        return 'invoice-theme';
      case 'followup':
      case 'follow_up':
        return 'followup-theme';
      default:
        return 'default-theme';
    }
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

  // Helper to extract diagnosis, notes, medicines, or titles for search
  const matchesSearch = (event: any, term: string) => {
    const cleanTerm = term.toLowerCase();
    const title = (event.title || '').toLowerCase();
    const type = (event.event_type || '').toLowerCase();
    
    let detailsText = '';
    if (event.details) {
      detailsText += JSON.stringify(event.details).toLowerCase();
    }
    
    return title.includes(cleanTerm) || type.includes(cleanTerm) || detailsText.includes(cleanTerm);
  };

  // Filter & Search timeline data
  const filteredTimeline = (timeline || []).filter(event => {
    const matchesFilter = activeFilter === 'all' || event.event_type === activeFilter || (activeFilter === 'followup' && event.event_type === 'follow_up');
    const matchesQuery = !searchTerm || matchesSearch(event, searchTerm);
    return matchesFilter && matchesQuery;
  });

  return (
    <div className="card timeline-card-container">
      <div className="card-title-bar timeline-header-bar">
        <h3 className="card-title"><Activity size={20} className="pulse-icon" /> Animated Health Journey</h3>
        <p className="card-subtitle">A chronological story of your healthcare activities and records</p>
      </div>

      {/* Filter and Search Bar */}
      <div className="timeline-filter-bar">
        <div className="timeline-search-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search symptoms, diagnosis, medicines..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="timeline-search-input"
          />
        </div>

        <div className="timeline-pills">
          <button 
            className={`timeline-pill-btn all ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            All Events
          </button>
          <button 
            className={`timeline-pill-btn visit ${activeFilter === 'visit' ? 'active' : ''}`}
            onClick={() => setActiveFilter('visit')}
          >
            <Stethoscope size={13} /> Visits
          </button>
          <button 
            className={`timeline-pill-btn prescription ${activeFilter === 'prescription' ? 'active' : ''}`}
            onClick={() => setActiveFilter('prescription')}
          >
            <Pill size={13} /> Prescriptions
          </button>
          <button 
            className={`timeline-pill-btn report ${activeFilter === 'report' ? 'active' : ''}`}
            onClick={() => setActiveFilter('report')}
          >
            <FileText size={13} /> Reports
          </button>
          <button 
            className={`timeline-pill-btn invoice ${activeFilter === 'invoice' ? 'active' : ''}`}
            onClick={() => setActiveFilter('invoice')}
          >
            <CreditCard size={13} /> Invoices
          </button>
          <button 
            className={`timeline-pill-btn followup ${activeFilter === 'followup' ? 'active' : ''}`}
            onClick={() => setActiveFilter('followup')}
          >
            <CalendarRange size={13} /> Follow-ups
          </button>
        </div>
      </div>

      {filteredTimeline.length > 0 ? (
        <div className="timeline-journey-wrapper">
          <div className="timeline-track-line" />
          <div className="timeline-list-premium">
            {filteredTimeline.map((event: any, idx: number) => {
              const eventKey = `${event.event_type}-${event.datetime}-${idx}`;
              const isExpanded = !!expandedKeys[eventKey];
              const themeClass = getEventColorClass(event.event_type);

              return (
                <div 
                  key={eventKey}
                  className={`timeline-item-premium ${themeClass} ${isExpanded ? 'expanded' : ''}`}
                >
                  {/* Left Date Column for Desktop */}
                  <div className="timeline-time-col">
                    <span className="event-date-main">{formatEventDate(event.datetime)}</span>
                    <span className="event-time-sub">{formatEventTime(event.datetime)}</span>
                  </div>

                  {/* Line Marker with custom Icon badge */}
                  <div className="timeline-marker-premium">
                    <div className="timeline-icon-badge">
                      {getEventIcon(event.event_type)}
                    </div>
                  </div>

                  {/* Interactive Card */}
                  <div 
                    className="timeline-card-premium"
                    onClick={() => {
                      if (event.event_type === 'visit' || event.event_type === 'prescription') {
                        setViewingHistoryEvent(event);
                      } else if (event.event_type === 'invoice') {
                        const fullBill = dashboardData?.bills?.find((b: any) => b.id === event.id || b.invoice_number === event.title);
                        setViewingInvoice(fullBill || event.details);
                      } else if (event.event_type === 'report') {
                        setViewingReport(event.details);
                      }
                    }}
                  >
                    {/* Header info */}
                    <div className="timeline-card-header">
                      <div className="timeline-header-main">
                        <span className="event-badge">{event.event_type === 'follow_up' ? 'follow-up' : event.event_type}</span>
                        <h4 className="event-title">{event.title}</h4>
                      </div>
                      <div className="timeline-header-actions">
                        <button 
                          className="expand-toggle-btn"
                          onClick={(e) => toggleExpand(eventKey, e)}
                          aria-label={isExpanded ? "Collapse details" : "Expand details"}
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Quick Preview Content */}
                    <div className="timeline-card-preview">
                      {event.event_type === 'visit' && event.details.diagnosis && (
                        <p className="preview-text"><strong>Diagnosis:</strong> {event.details.diagnosis}</p>
                      )}
                      {event.event_type === 'prescription' && (
                        <p className="preview-text">
                          <strong>Meds:</strong> {(event.details.medicines || [])?.slice(0, 2).map((m: any) => m.name || m.medicine_name).join(', ')}
                          {(event.details.medicines || [])?.length > 2 && '...'}
                        </p>
                      )}
                      {event.event_type === 'invoice' && (
                        <p className="preview-text"><strong>Amount:</strong> ₹{event.details.total_amount} | <strong>Status:</strong> <span className={`invoice-status-tag ${event.details.status}`}>{event.details.status}</span></p>
                      )}
                      {event.event_type === 'report' && (
                        <p className="preview-text"><strong>Category:</strong> {event.details.report_type}</p>
                      )}
                      {(event.event_type === 'followup' || event.event_type === 'follow_up') && (
                        <p className="preview-text">{event.details.notes}</p>
                      )}
                    </div>

                    {/* Expandable Content Area */}
                    {isExpanded && (
                      <div className="timeline-card-expanded" onClick={(e) => e.stopPropagation()}>
                        <div className="expanded-divider" />
                        
                        {/* Event specific details rendering */}
                        {event.event_type === 'visit' && (
                          <div className="expanded-visit-details">
                            {event.details.symptoms && (
                              <div className="detail-row">
                                <span className="detail-label">Reported Symptoms</span>
                                <p className="detail-val">{event.details.symptoms}</p>
                              </div>
                            )}
                            {event.details.notes && (
                              <div className="detail-row">
                                <span className="detail-label">Clinical Notes</span>
                                <p className="detail-val note-bubble">{event.details.notes}</p>
                              </div>
                            )}
                            <button 
                              className="timeline-action-btn"
                              onClick={() => setViewingHistoryEvent(event)}
                            >
                              <Eye size={14} /> View Full Consultation Summary
                            </button>
                          </div>
                        )}

                        {event.event_type === 'prescription' && (
                          <div className="expanded-prescription-details">
                            <span className="detail-label">Prescribed Medications</span>
                            <div className="medicine-timeline-grid">
                              {(event.details.medicines || event.details.medications)?.map((med: any, mIdx: number) => (
                                <div key={mIdx} className="medication-badge-card">
                                  <div className="med-icon"><Pill size={14} /></div>
                                  <div className="med-info">
                                    <div className="med-name">{med.name || med.medicine_name}</div>
                                    <div className="med-instructions">
                                      <span>{med.dosage}</span> • <span>{med.duration || `${med.duration_days} Days`}</span>
                                    </div>
                                    {med.instructions && <div className="med-notes">"{med.instructions}"</div>}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <button 
                              className="timeline-action-btn"
                              onClick={() => setViewingHistoryEvent(event)}
                            >
                              <Eye size={14} /> View & Print Prescription
                            </button>
                          </div>
                        )}

                        {event.event_type === 'invoice' && (
                          <div className="expanded-invoice-details">
                            <div className="invoice-summary-timeline">
                              <div className="invoice-metric">
                                <span className="metric-label">Total Billed</span>
                                <span className="metric-val">₹{event.details.total_amount}</span>
                              </div>
                              <div className="invoice-metric">
                                <span className="metric-label">Balance Due</span>
                                <span className={`metric-val ${event.details.balance_due > 0 ? 'due' : 'paid'}`}>
                                  ₹{event.details.balance_due}
                                </span>
                              </div>
                            </div>
                            <div className="timeline-card-actions">
                              <button 
                                className="timeline-action-btn"
                                onClick={() => {
                                  const fullBill = dashboardData?.bills?.find((b: any) => b.id === event.id || b.invoice_number === event.title);
                                  setViewingInvoice(fullBill || event.details);
                                }}
                              >
                                <Eye size={14} /> View Invoice Details
                              </button>
                            </div>
                          </div>
                        )}

                        {event.event_type === 'report' && (
                          <div className="expanded-report-details">
                            <div className="report-summary-box">
                              <div className="report-info-line">
                                <strong>Report Type:</strong> {event.details.report_type}
                              </div>
                            </div>
                            <div className="timeline-card-actions">
                              <button 
                                className="timeline-action-btn"
                                onClick={() => setViewingReport(event.details)}
                              >
                                <Eye size={14} /> Preview Document
                              </button>
                              {event.details.file_url && (
                                <a 
                                  href={event.details.file_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="timeline-action-btn secondary"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Download size={14} /> Download File
                                </a>
                              )}
                            </div>
                          </div>
                        )}

                        {(event.event_type === 'followup' || event.event_type === 'follow_up') && (
                          <div className="expanded-followup-details">
                            <div className="followup-alert-box">
                              <Sparkles size={16} className="sparkle-icon" />
                              <div className="followup-text">
                                Recommended follow-up date: <strong>{formatEventDate(event.datetime)}</strong>
                              </div>
                            </div>
                            <p className="followup-notes">{event.details.notes}</p>
                            
                            {event.details.status !== 'booked' && (
                              <button 
                                className="timeline-action-btn success"
                                onClick={() => {
                                  const found = followups.find(f => String(f.consultation_id) === String(event.details.consultation_id));
                                  if (found) {
                                    handleBookFollowup(found);
                                  } else {
                                    // Fallback mockup followup item
                                    handleBookFollowup({
                                      recommended_date: event.datetime,
                                      notes: event.details.notes
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
          <h4>No health events match your filters</h4>
          <p>Try searching for a different term or clearing your event type filters.</p>
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
