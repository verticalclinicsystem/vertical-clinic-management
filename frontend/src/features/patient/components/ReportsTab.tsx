import React, { useState } from 'react';
import { UploadCloud, Plus, Download, Trash2, Search } from 'lucide-react';

interface ReportsTabProps {
  dashboardData: any;
  setShowUploadModal: (show: boolean) => void;
  setViewingReport: (report: any) => void;
  setImageZoom: (zoom: number) => void;
  setImageRotate: (rotate: number) => void;
  handleDeleteReport: (reportId: string) => void;
}

export const ReportsTab: React.FC<ReportsTabProps> = ({
  dashboardData,
  setShowUploadModal,
  setViewingReport,
  setImageZoom,
  setImageRotate,
  handleDeleteReport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!dashboardData) return null;

  const filteredReports = dashboardData.reports?.filter((report: any) => {
    const title = (report.title || '').toLowerCase();
    const type = (report.report_type || '').toLowerCase();
    return title.includes(searchTerm.toLowerCase()) || type.includes(searchTerm.toLowerCase());
  }) || [];

  return (
    <div className="card">
      <div className="card-title-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h3 className="card-title" style={{ margin: 0 }}><UploadCloud size={18} /> Diagnostic Reports</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', minWidth: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted, #64748b)' }} />
            <input
              type="text"
              placeholder="Search reports..."
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
          </div>
          <button onClick={() => setShowUploadModal(true)} className="btn-primary" style={{ padding: '8px 12px', fontSize: '0.8rem' }}>
            <Plus size={14} /> Upload Report
          </button>
        </div>
      </div>

      <div className="table-container">
        <table className="portal-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Report Type</th>
              <th>Uploaded On</th>
              <th>File Size</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.map((report: any) => (
              <tr key={report.id}>
                <td style={{ fontWeight: 600 }}>{report.title}</td>
                <td>{report.report_type}</td>
                <td>{new Date(report.uploaded_at || report.created_at).toLocaleDateString()}</td>
                <td>{report.file_size ? `${(report.file_size / 1024).toFixed(1)} KB` : 'N/A'}</td>
                <td>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => {
                        setViewingReport(report);
                        setImageZoom(1);
                        setImageRotate(0);
                      }}
                      className="btn-secondary"
                      style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                    >
                      View
                    </button>
                    <a
                      href={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${report.file_url}`}
                      download
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary"
                      style={{ padding: '6px 10px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
                    >
                      <Download size={13} />
                    </a>
                    <button
                      onClick={() => handleDeleteReport(report.id)}
                      className="btn-danger-outline"
                      style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredReports.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                  {searchTerm ? 'No matching reports found.' : 'No medical reports uploaded yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
