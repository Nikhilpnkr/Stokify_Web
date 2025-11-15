

import { format } from 'date-fns';
import { Leaf } from 'lucide-react';
import React from 'react';
import type { StorageLocation } from '@/lib/data';

// Using inline styles for compatibility with server-side rendering and PDF generation

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
        display: 'flex',
        alignItems: 'center',
    },
    locationName: {
        fontSize: '28px',
        fontWeight: 'bold',
    },
    locationAddress: {
        fontSize: '14px',
        color: '#555',
        marginTop: '4px',
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
        width: '40%',
    },
    summaryRow: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '8px 0',
        fontSize: '14px',
    },
    summaryTotal: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '12px 0',
        fontSize: '18px',
        fontWeight: 'bold',
        borderTop: '2px solid #333',
        marginTop: '10px',
    },
    summaryBalanceDue: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '12px 0',
        fontSize: '18px',
        fontWeight: 'bold',
        backgroundColor: '#fff5f5',
        color: '#c53030',
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

export interface InvoiceData {
    type: 'Inflow' | 'Outflow';
    receiptNumber: string;
    date: Date;
    customer: {
        name: string;
        mobile: string;
    };
    user: {
        name: string;
        email: string;
    }
    items: {
        description: string;
        quantity: number;
        unit: string;
        unitPrice?: number;
        total?: number;
    }[];
    location: StorageLocation;
    labourCharge?: number;
    subTotal?: number;
    total?: number;
    amountPaid?: number;
    balanceDue?: number;
    notes?: string;
}

interface InvoiceProps {
    data: InvoiceData;
}


export function Invoice({ data }: InvoiceProps) {
    const isOutflow = data.type === 'Outflow';
    const isChargeable = isOutflow || (data.labourCharge && data.labourCharge > 0);
    
    let subTotal = data.subTotal || 0;
    if (!isOutflow && data.labourCharge) {
        subTotal = data.labourCharge;
    }

    let total = data.total || 0;
    if (!isOutflow && data.labourCharge) {
        total = data.labourCharge;
    }


    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <div style={styles.headerLeft}>
                     <div>
                        <h1 style={styles.locationName}>{data.location.name}</h1>
                        <p style={styles.locationAddress}>{data.location.address}</p>
                    </div>
                </div>
                <div style={styles.headerRight}>
                    <h2 style={styles.receiptTitle}>{data.type === 'Inflow' ? 'Inflow Receipt' : 'Outflow Invoice'}</h2>
                    <p style={styles.receiptNumber}># {data.receiptNumber}</p>
                    <p style={styles.receiptNumber}>Date: {format(data.date, "MMM d, yyyy")}</p>
                </div>
            </header>

            <section style={styles.detailsSection}>
                <div style={styles.detailsColumn}>
                    <h3 style={styles.detailsTitle}>Customer</h3>
                    <p style={styles.detailItem}><strong>{data.customer.name}</strong></p>
                    <p style={styles.detailItem}>{data.customer.mobile}</p>
                </div>
                <div style={styles.detailsColumn}>
                    <h3 style={styles.detailsTitle}>From</h3>
                    <p style={styles.detailItem}><strong>{data.location.name}</strong></p>
                    <p style={styles.detailItem}>Processed by: {data.user.name}</p>
                </div>
            </section>

            <section>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>Description</th>
                            <th style={{...styles.th, ...styles.textRight}}>Quantity</th>
                            {isOutflow && <th style={{...styles.th, ...styles.textRight}}>Unit Price</th>}
                            {isOutflow && <th style={{...styles.th, ...styles.textRight}}>Total</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {data.items.map((item, index) => (
                            <tr key={index}>
                                <td style={styles.td}>
                                    {item.description}
                                </td>
                                <td style={{...styles.td, ...styles.textRight}}>{item.quantity.toLocaleString()} {item.unit}</td>
                                {isOutflow && <td style={{...styles.td, ...styles.textRight}}>₹{item.unitPrice?.toFixed(2) || '0.00'}</td>}
                                {isOutflow && <td style={{...styles.td, ...styles.textRight}}>₹{item.total?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
            
            {isChargeable && (
                <section style={styles.summarySection}>
                    <div style={styles.summaryContainer}>
                        {isOutflow && (
                            <div style={styles.summaryRow}>
                                <span>Subtotal</span>
                                <span>₹{subTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</span>
                            </div>
                        )}
                         {data.labourCharge && data.labourCharge > 0 ? (
                           <div style={styles.summaryRow}>
                             <span>Labour Charges</span>
                             <span>₹{data.labourCharge.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                           </div>
                         ) : null}
                         {isOutflow && 
                            <div style={styles.summaryRow}>
                                <span>Taxes</span>
                                <span>₹0.00</span>
                            </div>
                         }
                        <div style={styles.summaryTotal}>
                            <span>Total Bill</span>
                            <span>₹{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</span>
                        </div>
                        {isOutflow && (
                            <>
                                <div style={styles.summaryRow}>
                                    <span>Amount Paid</span>
                                    <span>₹{(data.amountPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                {data.balanceDue && data.balanceDue > 0 ? (
                                    <div style={styles.summaryBalanceDue}>
                                        <span>Balance Due</span>
                                        <span>₹{data.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                ) : null}
                            </>
                        )}
                    </div>
                </section>
            )}

            {data.notes && (
                <section style={{ marginTop: '30px', fontSize: '14px', color: '#555' }}>
                    <h4 style={{ fontWeight: 'bold', marginBottom: '8px' }}>Notes</h4>
                    <p>{data.notes}</p>
                </section>
            )}


            <footer style={styles.footer}>
                <p>Thank you for choosing Stokify for your storage needs.</p>
                <p>Stokify Inc. | 123 Farming Lane, Harvest Town, 54321</p>
            </footer>
        </div>
    );
}
