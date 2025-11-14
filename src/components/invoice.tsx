
import { format } from 'date-fns';
import { Leaf } from 'lucide-react';
import React from 'react';

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
    logo: {
        width: '40px',
        height: '40px',
        marginRight: '12px',
        color: '#22c55e', // A green color
    },
    companyName: {
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
    location?: string;
    subTotal?: number;
    total?: number;
    notes?: string;
}

interface InvoiceProps {
    data: InvoiceData;
}


export function Invoice({ data }: InvoiceProps) {
    const isOutflow = data.type === 'Outflow';

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <div style={styles.headerLeft}>
                    <Leaf style={styles.logo} />
                    <h1 style={styles.companyName}>CropSafe</h1>
                </div>
                <div style={styles.headerRight}>
                    <h2 style={styles.receiptTitle}>{data.type} Receipt</h2>
                    <p style={styles.receiptNumber}># {data.receiptNumber}</p>
                    <p style={styles.receiptNumber}>Date: {format(data.date, "MMM d, yyyy")}</p>
                </div>
            </header>

            <section style={styles.detailsSection}>
                <div style={styles.detailsColumn}>
                    <h3 style={styles.detailsTitle}>Billed To</h3>
                    <p style={styles.detailItem}><strong>{data.customer.name}</strong></p>
                    <p style={styles.detailItem}>{data.customer.mobile}</p>
                </div>
                <div style={styles.detailsColumn}>
                    <h3 style={styles.detailsTitle}>From</h3>
                    <p style={styles.detailItem}><strong>CropSafe Inc.</strong></p>
                    <p style={styles.detailItem}>Processed by: {data.user.name}</p>
                    <p style={styles.detailItem}>{data.user.email}</p>
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
                                    {data.location && <div style={{ fontSize: '12px', color: '#666' }}>at {data.location}</div>}
                                </td>
                                <td style={{...styles.td, ...styles.textRight}}>{item.quantity.toLocaleString()} {item.unit}</td>
                                {isOutflow && <td style={{...styles.td, ...styles.textRight}}>${item.unitPrice?.toFixed(2) || '0.00'}</td>}
                                {isOutflow && <td style={{...styles.td, ...styles.textRight}}>${item.total?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </section>
            
            {isOutflow && (
                <section style={styles.summarySection}>
                    <div style={styles.summaryContainer}>
                        <div style={styles.summaryRow}>
                            <span>Subtotal</span>
                            <span>${data.subTotal?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</span>
                        </div>
                         <div style={styles.summaryRow}>
                            <span>Taxes</span>
                            <span>$0.00</span>
                        </div>
                        <div style={styles.summaryTotal}>
                            <span>Total</span>
                            <span>${data.total?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</span>
                        </div>
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
                <p>Thank you for choosing CropSafe for your storage needs.</p>
                <p>CropSafe Inc. | 123 Farming Lane, Harvest Town, 54321</p>
            </footer>
        </div>
    );
}
