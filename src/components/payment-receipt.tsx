
import { format } from 'date-fns';
import React from 'react';

const styles = {
    container: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        color: '#333',
        backgroundColor: '#ffffff',
        padding: '40px',
        width: '800px',
        border: '1px solid #eee',
        boxShadow: '0 0 10px rgba(0, 0, 0, 0.05)',
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottom: '2px solid #333',
        paddingBottom: '20px',
        marginBottom: '20px',
    },
    headerLeft: {
        fontSize: '28px',
        fontWeight: 'bold',
    },
    headerRight: {
        textAlign: 'right',
    },
    receiptTitle: {
        fontSize: '24px',
        fontWeight: '600',
        color: '#111',
    },
    receiptNumber: {
        fontSize: '14px',
        color: '#555',
    },
    detailsSection: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '30px',
        backgroundColor: '#f8f8f8',
        padding: '20px',
        borderRadius: '8px'
    },
    detailsColumn: {
        width: '48%',
    },
    detailsTitle: {
        fontSize: '14px',
        fontWeight: 'bold',
        color: '#555',
        borderBottom: '1px solid #eee',
        paddingBottom: '5px',
        marginBottom: '10px',
    },
    detailItem: {
        fontSize: '14px',
        marginBottom: '4px',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        marginBottom: '30px',
    } as React.CSSProperties,
    th: {
        backgroundColor: '#f8f8f8',
        borderBottom: '2px solid #ddd',
        padding: '12px 8px',
        textAlign: 'left',
        fontSize: '12px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
    } as React.CSSProperties,
    td: {
        borderBottom: '1px solid #eee',
        padding: '12px 8px',
        fontSize: '14px',
    },
    textRight: {
        textAlign: 'right',
    } as React.CSSProperties,
    summarySection: {
        display: 'flex',
        justifyContent: 'flex-end',
    },
    summaryContainer: {
        width: '50%',
        marginTop: '20px'
    },
    summaryRow: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 12px',
        fontSize: '14px',
        borderRadius: '4px',
    },
    summaryTotal: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '12px',
        fontSize: '18px',
        fontWeight: 'bold',
        borderTop: '2px solid #333',
        marginTop: '10px',
    },
    footer: {
        marginTop: '40px',
        paddingTop: '20px',
        borderTop: '1px solid #eee',
        textAlign: 'center',
        fontSize: '12px',
        color: '#888',
    },
};

export interface PaymentReceiptData {
    paymentId: string;
    paymentDate: Date;
    paymentMethod: string;
    amountPaid: number;
    notes?: string;
    customer: {
        name: string;
        mobile: string;
    };
    outflowId: string;
    outflowDate: Date;
    totalBill: number;
    previousBalance: number;
    newBalance: number;
}

interface PaymentReceiptProps {
    data: PaymentReceiptData;
}


export function PaymentReceipt({ data }: PaymentReceiptProps) {
    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <h1 style={styles.headerLeft}>Stokify</h1>
                <div style={styles.headerRight}>
                    <h2 style={styles.receiptTitle}>Payment Receipt</h2>
                    <p style={styles.receiptNumber}>Receipt # {data.paymentId}</p>
                    <p style={styles.receiptNumber}>Date: {format(data.paymentDate, "MMM d, yyyy")}</p>
                </div>
            </header>

            <section style={styles.detailsSection}>
                <div style={styles.detailsColumn}>
                    <h3 style={styles.detailsTitle}>Paid By</h3>
                    <p style={styles.detailItem}><strong>{data.customer.name}</strong></p>
                    <p style={styles.detailItem}>{data.customer.mobile}</p>
                </div>
                <div style={styles.detailsColumn}>
                    <h3 style={styles.detailsTitle}>Payment For</h3>
                    <p style={styles.detailItem}>Outflow Transaction #: {data.outflowId}</p>
                    <p style={styles.detailItem}>Transaction Date: {format(data.outflowDate, "MMM d, yyyy")}</p>
                </div>
            </section>
            
            <section>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Description</th>
                            <th style={{...styles.th, ...styles.textRight}}>Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style={styles.td}>Payment Received</td>
                            <td style={{...styles.td, ...styles.textRight, fontWeight: 'bold'}}>₹{data.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                    </tbody>
                </table>
            </section>
            
            <section style={styles.summarySection}>
                <div style={styles.summaryContainer}>
                    <div style={styles.summaryRow}>
                        <span>Original Bill Amount</span>
                        <span>₹{data.totalBill.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div style={styles.summaryRow}>
                        <span>Balance Before Payment</span>
                        <span>₹{data.previousBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                     <div style={{...styles.summaryRow, backgroundColor: '#e6f7ff' }}>
                        <span>This Payment</span>
                        <span style={{fontWeight: 'bold'}}>- ₹{data.amountPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div style={styles.summaryTotal}>
                        <span>Remaining Balance</span>
                        <span>₹{data.newBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </section>

             {data.notes && (
                <section style={{ marginTop: '30px', fontSize: '14px', color: '#555' }}>
                    <h4 style={{ fontWeight: 'bold', marginBottom: '8px' }}>Notes</h4>
                    <p style={{fontStyle: 'italic'}}>{data.notes}</p>
                </section>
            )}

            <footer style={styles.footer}>
                <p>Thank you for your business!</p>
                <p>Payment Method: {data.paymentMethod}</p>
            </footer>
        </div>
    );
}

