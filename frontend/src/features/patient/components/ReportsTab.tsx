import React, { useState, useMemo } from 'react';
import {
  UploadCloud,
  Plus,
  Download,
  Search,
  Info,
  Eye,
  FileText,
  Activity,
  Microscope,
  LayoutGrid,
  List,
  Calendar,
  CheckCircle2,
  X
} from 'lucide-react';

interface ReportsTabProps {
  dashboardData: any;
  setShowUploadModal: (show: boolean) => void;
  setViewingReport: (report: any) => void;
  setImageZoom: (zoom: number) => void;
  setImageRotate: (rotate: number) => void;
  downloadPdf: (url: string, filename: string) => void;
  handleDeleteReport?: (reportId: string) => void;
}

type CategoryType = 'all' | 'radiology' | 'pathology' | 'other';
type ViewMode = 'grid' | 'table';

export const ReportsTab: React.FC<ReportsTabProps> = ({
  dashboardData,
  setShowUploadModal,
  setViewingReport,
  setImageZoom,
  setImageRotate,
  downloadPdf,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const allReports: any[] = useMemo(() => {
    return dashboardData?.reports || [];
  }, [dashboardData]);

  // Helper to categorize reports
  const getCategory = (report: any): 'radiology' | 'pathology' | 'other' => {
    const text = `${report.report_type || ''} ${report.title || ''} ${report.report_name || ''}`.toLowerCase();
    if (
      text.includes('x-ray') ||
      text.includes('xray') ||
      text.includes('ct') ||
      text.includes('mri') ||
      text.includes('scan') ||
      text.includes('ultrasound') ||
      text.includes('sonography') ||
      text.includes('radiology') ||
      text.includes('imaging') ||
      text.includes('mammogram') ||
      text.includes('echo')
    ) {
      return 'radiology';
    }
    if (
      text.includes('blood') ||
      text.includes('lab') ||
      text.includes('pathology') ||
      text.includes('urine') ||
      text.includes('biopsy') ||
      text.includes('cbc') ||
      text.includes('lipid') ||
      text.includes('culture') ||
      text.includes('serology') ||
      text.includes('test') ||
      text.includes('panel')
    ) {
      return 'pathology';
    }
    return 'other';
  };

  const isPdfFile = (url: string = '') => {
    const lower = (url || '').toLowerCase();
    return lower.endsWith('.pdf') || lower.includes('/raw/') || lower.includes('.pdf?');
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Date not recorded';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Metrics counts
  const radiologyCount = useMemo(() => allReports.filter(r => getCategory(r) === 'radiology').length, [allReports]);
  const labCount = useMemo(() => allReports.filter(r => getCategory(r) === 'pathology').length, [allReports]);
  const otherCount = useMemo(() => allReports.filter(r => getCategory(r) === 'other').length, [allReports]);

  // Filtered reports
  const filteredReports = useMemo(() => {
    return allReports.filter((report: any) => {
      const title = (report.title || report.report_name || '').toLowerCase();
      const type = (report.report_type || '').toLowerCase();
      const matchesSearch = title.includes(searchTerm.toLowerCase()) || type.includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;
      if (selectedCategory === 'all') return true;
      return getCategory(report) === selectedCategory;
    });
  }, [allReports, searchTerm, selectedCategory]);

  const getCategoryMeta = (cat: 'radiology' | 'pathology' | 'other', reportType: string) => {
    if (cat === 'radiology') {
      return {
        label: reportType || 'Radiology / Scan',
        icon: <Activity size={13} />,
        bg: '#eff6ff',
        color: '#1d4ed8',
        border: '#bfdbfe',
        iconBg: '#dbeafe',
      };
    }
    if (cat === 'pathology') {
      return {
        label: reportType || 'Pathology / Lab',
        icon: <Microscope size={13} />,
        bg: '#ecfdf5',
        color: '#047857',
        border: '#a7f3d0',
        iconBg: '#d1fae5',
      };
    }
    return {
      label: reportType || 'Clinical Record',
      icon: <FileText size={13} />,
      bg: '#f8fafc',
      color: '#475569',
      border: '#cbd5e1',
      iconBg: '#f1f5f9',
    };
  };

  const handleDownload = (report: any) => {
    const url = report.file_url?.startsWith('http')
      ? report.file_url
      : `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${report.file_url}`;
    const filename = `${report.report_name || report.title || 'medical_report'}.pdf`;
    downloadPdf(url, filename);
  };

  const handleView = (report: any) => {
    setViewingReport(report);
    setImageZoom(1);
    setImageRotate(0);
  };

  if (!dashboardData) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* ── Quick Upload Assistant Banner ── */}
      <div style={{
        backgroundColor: 'var(--surface, #ffffff)',
        border: '1px solid #bfdbfe',
        background: 'linear-gradient(135deg, #f0f9ff 0%, #f8fafc 100%)',
        borderRadius: '14px',
        padding: '18px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: '0 2px 8px rgba(37, 99, 235, 0.04)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', maxWidth: '720px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '12px',
            backgroundColor: '#dbeafe',
            color: '#1d4ed8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <UploadCloud size={24} />
          </div>
          <div>
            <h4 style={{ margin: '0 0 3px 0', fontSize: '0.96rem', fontWeight: 700, color: 'var(--ink, #0f172a)' }}>
              Need to share an external lab report, scan, or diagnostic file?
            </h4>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted, #64748b)', lineHeight: 1.45 }}>
              Upload your documents (PDF, JPG, PNG). They will automatically be attached to your clinical chart for your doctor’s review during your visit.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="btn-primary"
          style={{
            padding: '10px 18px',
            fontSize: '0.85rem',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(12, 110, 140, 0.2)'
          }}
        >
          <Plus size={16} /> Upload New Report
        </button>
      </div>

      {/* ── 3. Main Reports Container ── */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        {/* Top Control Bar */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border, #e2e8f0)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          {/* Category Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelectedCategory('all')}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.82rem',
                fontWeight: 600,
                border: selectedCategory === 'all' ? '1px solid var(--primary-teal, #0c6e8c)' : '1px solid #e2e8f0',
                backgroundColor: selectedCategory === 'all' ? 'var(--primary-teal, #0c6e8c)' : '#ffffff',
                color: selectedCategory === 'all' ? '#ffffff' : 'var(--text-muted, #64748b)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              All Reports <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>({allReports.length})</span>
            </button>

            <button
              onClick={() => setSelectedCategory('radiology')}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.82rem',
                fontWeight: 600,
                border: selectedCategory === 'radiology' ? '1px solid #2563eb' : '1px solid #e2e8f0',
                backgroundColor: selectedCategory === 'radiology' ? '#eff6ff' : '#ffffff',
                color: selectedCategory === 'radiology' ? '#1d4ed8' : 'var(--text-muted, #64748b)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Activity size={13} /> Scans &amp; Imaging <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>({radiologyCount})</span>
            </button>

            <button
              onClick={() => setSelectedCategory('pathology')}
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.82rem',
                fontWeight: 600,
                border: selectedCategory === 'pathology' ? '1px solid #059669' : '1px solid #e2e8f0',
                backgroundColor: selectedCategory === 'pathology' ? '#ecfdf5' : '#ffffff',
                color: selectedCategory === 'pathology' ? '#047857' : 'var(--text-muted, #64748b)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Microscope size={13} /> Labs &amp; Pathology <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>({labCount})</span>
            </button>

            {otherCount > 0 && (
              <button
                onClick={() => setSelectedCategory('other')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  border: selectedCategory === 'other' ? '1px solid #64748b' : '1px solid #e2e8f0',
                  backgroundColor: selectedCategory === 'other' ? '#f1f5f9' : '#ffffff',
                  color: selectedCategory === 'other' ? '#1e293b' : 'var(--text-muted, #64748b)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <FileText size={13} /> Other Records <span style={{ opacity: 0.8, fontSize: '0.75rem' }}>({otherCount})</span>
              </button>
            )}
          </div>

          {/* Search & Layout Toggles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', width: '240px' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted, #64748b)'
                }}
              />
              <input
                type="text"
                placeholder="Search by title or type..."
                list="patient-reports-search-suggestions"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '7px 28px 7px 32px',
                  fontSize: '0.84rem',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  width: '100%',
                  outline: 'none',
                  backgroundColor: 'var(--bg-white, #ffffff)',
                  color: 'var(--text-main, #1e293b)'
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex'
                  }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
              <datalist id="patient-reports-search-suggestions">
                {Array.from(new Set(allReports.map((r: any) => r.title || r.report_name))).map((title: any) => (
                  <option key={title} value={title} />
                ))}
              </datalist>
            </div>

            {/* Grid / Table Mode Switcher */}
            <div style={{
              display: 'inline-flex',
              backgroundColor: '#f1f5f9',
              borderRadius: '8px',
              padding: '2px',
              border: '1px solid #e2e8f0'
            }}>
              <button
                onClick={() => setViewMode('grid')}
                title="Grid View"
                style={{
                  border: 'none',
                  background: viewMode === 'grid' ? '#ffffff' : 'transparent',
                  color: viewMode === 'grid' ? 'var(--primary-teal, #0c6e8c)' : '#64748b',
                  borderRadius: '6px',
                  padding: '5px 9px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  boxShadow: viewMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <LayoutGrid size={15} /> Grid
              </button>
              <button
                onClick={() => setViewMode('table')}
                title="Table View"
                style={{
                  border: 'none',
                  background: viewMode === 'table' ? '#ffffff' : 'transparent',
                  color: viewMode === 'table' ? 'var(--primary-teal, #0c6e8c)' : '#64748b',
                  borderRadius: '6px',
                  padding: '5px 9px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <List size={15} /> Table
              </button>
            </div>
          </div>
        </div>

        {/* Content Area: Grid or Table */}
        <div style={{ padding: viewMode === 'grid' ? '20px' : '0' }}>
          {filteredReports.length === 0 ? (
            <div style={{
              padding: '48px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8'
              }}>
                <FileText size={28} />
              </div>
              <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--ink, #1e293b)' }}>
                {searchTerm || selectedCategory !== 'all' ? 'No matching reports found' : 'No diagnostic reports uploaded yet'}
              </h4>
              <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-muted, #64748b)', maxWidth: '420px' }}>
                {searchTerm || selectedCategory !== 'all'
                  ? 'Try modifying your search term or selecting "All Reports" from the category filter.'
                  : 'Diagnostic documents, laboratory test results, and imaging scans uploaded by you or the clinic will appear here.'}
              </p>
              {(searchTerm || selectedCategory !== 'all') ? (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategory('all');
                  }}
                  className="btn-secondary"
                  style={{ marginTop: '8px', fontSize: '0.8rem', padding: '6px 14px' }}
                >
                  Clear Filters
                </button>
              ) : (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="btn-primary"
                  style={{ marginTop: '8px', fontSize: '0.82rem', padding: '8px 16px' }}
                >
                  <Plus size={14} /> Upload First Report
                </button>
              )}
            </div>
          ) : viewMode === 'grid' ? (
            /* ── GRID CARDS VIEW ── */
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '18px'
            }}>
              {filteredReports.map((report: any) => {
                const cat = getCategory(report);
                const meta = getCategoryMeta(cat, report.report_type);
                const isPdf = isPdfFile(report.file_url);

                return (
                  <div
                    key={report.id}
                    className="report-card"
                    style={{
                      backgroundColor: 'var(--surface, #ffffff)',
                      border: '1px solid var(--border, #e2e8f0)',
                      borderRadius: '12px',
                      padding: '18px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
                      transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
                      position: 'relative'
                    }}
                  >
                    <div>
                      {/* Top Badges */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          backgroundColor: meta.bg,
                          color: meta.color,
                          border: `1px solid ${meta.border}`
                        }}>
                          {meta.icon}
                          {meta.label}
                        </span>

                        <span style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          color: '#059669',
                          backgroundColor: '#ecfdf5',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <CheckCircle2 size={11} /> Verified
                        </span>
                      </div>

                      {/* Title & Preview Indicator */}
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '14px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          backgroundColor: meta.iconBg,
                          color: meta.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {meta.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 style={{
                            margin: '0 0 4px 0',
                            fontSize: '0.94rem',
                            fontWeight: 700,
                            color: 'var(--ink, #1e293b)',
                            lineHeight: 1.35,
                            wordBreak: 'break-word'
                          }}>
                            {report.title || report.report_name}
                          </h4>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.76rem',
                            color: 'var(--text-muted, #64748b)'
                          }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Calendar size={12} /> {formatDate(report.uploaded_at || report.created_at)}
                            </span>
                            <span>•</span>
                            <span style={{
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              fontSize: '0.68rem',
                              color: isPdf ? '#dc2626' : '#2563eb',
                              backgroundColor: isPdf ? '#fef2f2' : '#eff6ff',
                              padding: '1px 6px',
                              borderRadius: '4px'
                            }}>
                              {isPdf ? 'PDF' : 'IMAGE'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      paddingTop: '14px',
                      borderTop: '1px solid #f1f5f9'
                    }}>
                      <button
                        onClick={() => handleView(report)}
                        className="btn-secondary"
                        style={{
                          flex: 1,
                          padding: '7px 12px',
                          fontSize: '0.8rem',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <Eye size={14} /> View File
                      </button>

                      <button
                        onClick={() => handleDownload(report)}
                        className="btn-secondary"
                        style={{
                          flex: 1,
                          padding: '7px 12px',
                          fontSize: '0.8rem',
                          justifyContent: 'center',
                          gap: '6px',
                          color: 'var(--primary-teal, #0c6e8c)',
                          borderColor: '#cbd5e1'
                        }}
                        title="Download file"
                      >
                        <Download size={14} /> Download
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── TABLE VIEW ── */
            <div className="table-container" style={{ margin: 0 }}>
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>Report Title</th>
                    <th>Category</th>
                    <th>Format</th>
                    <th>Uploaded Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReports.map((report: any) => {
                    const cat = getCategory(report);
                    const meta = getCategoryMeta(cat, report.report_type);
                    const isPdf = isPdfFile(report.file_url);

                    return (
                      <tr key={report.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              backgroundColor: meta.iconBg,
                              color: meta.color,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {meta.icon}
                            </div>
                            <span style={{ fontWeight: 600, color: 'var(--ink, #1e293b)' }}>
                              {report.title || report.report_name}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            backgroundColor: meta.bg,
                            color: meta.color,
                            border: `1px solid ${meta.border}`
                          }}>
                            {meta.label}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            fontSize: '0.7rem',
                            color: isPdf ? '#dc2626' : '#2563eb',
                            backgroundColor: isPdf ? '#fef2f2' : '#eff6ff',
                            padding: '2px 7px',
                            borderRadius: '4px'
                          }}>
                            {isPdf ? 'PDF' : 'IMAGE'}
                          </span>
                        </td>
                        <td>{formatDate(report.uploaded_at || report.created_at)}</td>
                        <td>
                          <span style={{
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            color: '#059669',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <CheckCircle2 size={13} /> Verified
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px' }}>
                            <button
                              onClick={() => handleView(report)}
                              className="btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '0.76rem' }}
                            >
                              <Eye size={13} /> View
                            </button>
                            <button
                              onClick={() => handleDownload(report)}
                              className="btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '0.76rem' }}
                              title="Download document"
                            >
                              <Download size={13} /> Download
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── 4. Clinical Audit / Permanent Record Notice ── */}
        <div style={{
          padding: '14px 20px',
          backgroundColor: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          fontSize: '0.78rem',
          color: '#64748b',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <Info size={16} color="#0284c7" style={{ flexShrink: 0 }} />
          <span>
            Uploaded diagnostic documents become an official part of your permanent clinical history and are securely encrypted. To remove or replace an incorrectly uploaded file, please request our reception desk during your visit.
          </span>
        </div>
      </div>
    </div>
  );
};

