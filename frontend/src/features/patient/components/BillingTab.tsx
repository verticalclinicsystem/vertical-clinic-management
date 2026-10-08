import React from 'react';
import { CreditCard, Download, Eye, CheckCircle2, Clock, AlertTriangle, FileText } from 'lucide-react';

interface BillingTabProps {
  dashboardData: any;
  setViewingInvoice: (invoice: any) => void;
  downloadPdf: (url: string, filename: string) => void;
}

export const BillingTab: React.FC<BillingTabProps> = ({
  dashboardData,
  setViewingInvoice,
  downloadPdf,
}) => {
  if (!dashboardData) return null;

  const bills: any[] = dashboardData.bills || [];

  const totalInvoiced = bills.reduce((acc, b) => acc + (Number(b.grand_total ?? b.total_amount) || 0), 0);
  const totalPaid = bills.reduce((acc, b) => acc + (Number(b.amount_paid) || 0), 0);
  const totalBalanceDue = bills.reduce((acc, b) => acc + (Number(b.balance_due) || 0), 0);

  const formatStatus = (status: string) => {
    switch (status) {
      case 'paid':
        return <span className="status-pill paid"><CheckCircle2 size={12} /> Paid</span>;
      case 'partially_paid':
        return <span className="status-pill partially_paid"><Clock size={12} /> Partially Paid</span>;
      case 'unpaid':
        return <span className="status-pill unpaid"><AlertTriangle size={12} /> Unpaid</span>;
      default:
        return <span className="status-pill">{status?.replace('_', ' ')}</span>;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ── Summary Stats Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}>
            <FileText size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Invoiced</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ink)' }}>₹{totalInvoiced.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Paid</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: totalBalanceDue > 0 ? '#fef2f2' : '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center', color: totalBalanceDue > 0 ? '#dc2626' : '#16a34a' }}>
            {totalBalanceDue > 0 ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Balance Due</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: totalBalanceDue > 0 ? '#dc2626' : '#16a34a' }}>
              ₹{totalBalanceDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Invoices Table ── */}
      <div className="card">
        <div className="card-title-bar">
          <h3 className="card-title"><CreditCard size={18} /> Invoices &amp; Billing History</h3>
        </div>
        <div className="table-container">
          <table className="portal-table">
            <thead>
              <tr>
                <th>Invoice Code</th>
                <th>Invoice Date</th>
                <th>Total Bill</th>
                <th>Amount Paid</th>
                <th>Balance Due</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill: any) => {
                const grandTotal = Number(bill.grand_total ?? bill.total_amount) || 0;
                const paid = Number(bill.amount_paid) || 0;
                const due = Number(bill.balance_due) || 0;

                return (
                  <tr
                    key={bill.id}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => {
                      const target = e.target as HTMLElement;
                      if (target.tagName.toLowerCase() === 'button' || target.closest('button')) {
                        return;
                      }
                      setViewingInvoice(bill);
                    }}
                  >
                    <td>
                      <span style={{ 
                        fontFamily: 'monospace', 
                        fontWeight: 700, 
                        color: 'var(--primary)',
                        backgroundColor: '#f1f5f9',
                        padding: '3px 7px',
                        borderRadius: '4px'
                      }}>
                        {bill.invoice_number}
                      </span>
                    </td>
                    <td>{formatDate(bill.created_at || bill.due_date)}</td>
                    <td style={{ fontWeight: 600 }}>₹{grandTotal.toFixed(2)}</td>
                    <td style={{ color: '#059669', fontWeight: 600 }}>₹{paid.toFixed(2)}</td>
                    <td style={{ color: due > 0 ? '#dc2626' : '#059669', fontWeight: 700 }}>
                      ₹{due.toFixed(2)}
                    </td>
                    <td>{formatStatus(bill.status)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setViewingInvoice(bill)}
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                        >
                          <Eye size={13} /> View
                        </button>
                        <button
                          onClick={() => downloadPdf(`/billing/${bill.id}/download-pdf`, `Invoice_${bill.invoice_number}.pdf`)}
                          className="btn-secondary"
                          style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                        >
                          <Download size={13} /> PDF Invoice
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {bills.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No invoice statements found for your account.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
