import React from 'react';
import { CreditCard, Download } from 'lucide-react';

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

  return (
    <div className="card">
      <div className="card-title-bar">
        <h3 className="card-title"><CreditCard size={18} /> Invoices &amp; Payments</h3>
      </div>
      <div className="table-container">
        <table className="portal-table">
          <thead>
            <tr>
              <th>Invoice Code</th>
              <th>Due Date</th>
              <th>Total Amount</th>
              <th>Paid Amount</th>
              <th>Balance Due</th>
              <th>Status</th>
              <th>Download</th>
            </tr>
          </thead>
          <tbody>
            {dashboardData.bills?.map((bill: any) => (
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
                <td style={{ fontFamily: 'monospace' }}>{bill.invoice_number}</td>
                <td>{new Date(bill.due_date).toLocaleDateString()}</td>
                <td>₹{bill.total_amount}</td>
                <td>₹{bill.paid_amount}</td>
                <td style={{ color: bill.balance_due > 0 ? 'var(--error-red)' : 'inherit', fontWeight: 600 }}>
                  ₹{bill.balance_due}
                </td>
                <td>
                  <span className={`status-pill ${bill.status}`}>{bill.status}</span>
                </td>
                <td>
                  <button
                    onClick={() => downloadPdf(`/billing/${bill.id}/pdf`, `Invoice_${bill.invoice_number}.pdf`)}
                    className="btn-secondary"
                    style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                  >
                    <Download size={13} /> PDF Invoice
                  </button>
                </td>
              </tr>
            ))}
            {(!dashboardData.bills || dashboardData.bills.length === 0) && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No invoice statements available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
