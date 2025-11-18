
import { format } from 'date-fns';
import React from 'react';
import type { StorageLocation } from '@/lib/data';

// Using inline styles for compatibility with server-side rendering and PDF generation

const styles = {
    container: {
        fontFamily: "'PT Sans', sans-serif",
        color: '#333',
        backgroundColor: '#ffffff',
        padding: '40px',
        width: '800px',
    },
    header: {
        marginBottom: '30px',
    },
    locationName: {
        fontSize: '24px',
        fontWeight: 'bold',
        color: '#2E8B57', // SeaGreen
        margin: '0',
    },
    receiptTitle: {
        fontSize: '36px',
        fontWeight: 'bold',
        color: '#2E8B57',
        margin: '0 0 20px 0',
    },
    metaSection: {
        display: 'flex',
        justifyContent: 'space-between',
        borderTop: '1px solid #ccc',
        borderBottom: '1px solid #ccc',
        padding: '10px 0',
        marginBottom: '30px',
        fontSize: '12px'
    },
    metaItem: {
        display: 'flex',
        flexDirection: 'column',
    } as React.CSSProperties,
    metaLabel: {
        color: '#666',
        marginBottom: '4px',
    },
    metaValue: {
        fontWeight: 'bold',
    },
    detailsSection: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: '20px',
        marginBottom: '30px',
    },
    detailsBox: {
        width: '48%',
        border: '1px solid #ccc',
        padding: '15px',
        borderRadius: '5px',
    },
    detailsTitle: {
        fontSize: '12px',
        fontWeight: 'bold',
        color: '#2E8B57',
        marginBottom: '8px',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
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
        backgroundColor: 'rgba(46, 139, 87, 0.1)', // Light green
        padding: '12px 15px',
        textAlign: 'left',
        fontSize: '12px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        color: '#2E8B57',
    } as React.CSSProperties,
    td: {
        borderBottom: '1px solid #eee',
        padding: '15px',
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
        width: '45%',
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
        fontSize: '20px',
        fontWeight: 'bold',
        color: '#2E8B57',
        borderTop: '2px solid #2E8B57',
        marginTop: '10px',
    },
    summaryBalanceDue: {
        display: 'flex',
        justifyContent: 'space-between',
        padding: '12px',
        fontSize: '20px',
        fontWeight: 'bold',
        backgroundColor: '#fff0f0',
        color: '#c53030',
        marginTop: '10px',
        borderRadius: '5px'
    },
    footer: {
        marginTop: '50px',
        paddingTop: '20px',
        borderTop: '1px solid #eee',
        textAlign: 'center',
        fontSize: '12px',
        color: '#888',
    },
};

export interface InvoiceItem {
    description: string;
    quantity: number;
    unit: string;
    storageArea?: string;
    unitPrice?: number;
    total?: number;
}
export interface InvoiceData {
    type: 'Inflow' | 'Outflow';
    receiptNumber: string;
    date: Date;
    paymentMethod: string;
    customer: {
        name: string;
        mobile: string;
    };
    user: {
        name: string;
        email: string;
    }
    items: InvoiceItem[];
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
                <h1 style={styles.locationName}>{data.location.name}</h1>
                <h2 style={styles.receiptTitle}>{data.type === 'Inflow' ? 'Delivery Warehouse Receipt' : 'Outflow Invoice'}</h2>
            </header>

            <section style={styles.metaSection}>
                <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Receipt Number</span>
                    <span style={styles.metaValue}>{data.receiptNumber}</span>
                </div>
                 <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Receipt Date</span>
                    <span style={styles.metaValue}>{format(data.date, "yyyy-MM-dd HH:mm")}</span>
                </div>
                 <div style={styles.metaItem}>
                    <span style={styles.metaLabel}>Payment Method</span>
                    <span style={styles.metaValue}>{data.paymentMethod}</span>
                </div>
            </section>

            <section style={styles.detailsSection}>
                <div style={styles.detailsBox}>
                    <h3 style={styles.detailsTitle}>Customer</h3>
                    <p style={styles.detailItem}><strong>{data.customer.name}</strong></p>
                    <p style={styles.detailItem}>{data.customer.mobile}</p>
                </div>
                <div style={styles.detailsBox}>
                    <h3 style={styles.detailsTitle}>Owner</h3>
                    <p style={styles.detailItem}>{data.user.name}</p>
                </div>
            </section>

            <section>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={styles.th}>QTY</th>
                            <th style={styles.th}>Description</th>
                             <th style={styles.th}>Storage Area</th>
                            {isOutflow && <th style={{...styles.th, ...styles.textRight}}>Rent Per Bag</th>}
                            <th style={{...styles.th, ...styles.textRight}}>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.items.map((item, index) => (
                            <tr key={index}>
                                <td style={styles.td}>{item.quantity.toLocaleString()}</td>
                                <td style={styles.td}>{item.description}</td>
                                <td style={styles.td}>{item.storageArea || 'N/A'}</td>
                                {isOutflow && <td style={{...styles.td, ...styles.textRight}}>{item.unitPrice?.toFixed(2) || '0.00'} Rps</td>}
                                <td style={{...styles.td, ...styles.textRight}}>{item.total?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} Rps</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
            
            {(isOutflow || data.labourCharge) && (
                <section style={styles.summarySection}>
                    <div style={styles.summaryContainer}>
                        {isOutflow && (
                            <div style={styles.summaryRow}>
                                <span>Subtotal</span>
                                <span>{subTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} Rps</span>
                            </div>
                        )}
                         {data.labourCharge && data.labourCharge > 0 ? (
                           <div style={styles.summaryRow}>
                             <span>Labour Charges</span>
                             <span>{data.labourCharge.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Rps</span>
                           </div>
                         ) : null}
                        
                        <div style={styles.summaryTotal}>
                            <span>Total</span>
                            <span>{total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} Rps</span>
                        </div>

                        {isOutflow && (
                            <>
                                <div style={styles.summaryRow}>
                                    <span>Amount Paid</span>
                                    <span>{(data.amountPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Rps</span>
                                </div>
                                {data.balanceDue !== undefined && data.balanceDue > 0 ? (
                                    <div style={styles.summaryBalanceDue}>
                                        <span>Balance Due</span>
                                        <span>{data.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Rps</span>
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
