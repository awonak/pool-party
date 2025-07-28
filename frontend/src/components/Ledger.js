import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function Ledger() {
  const [transactions, setTransactions] = useState([]);
  const [totalDonations, setTotalDonations] = useState(0);
  const [totalWithdrawals, setTotalWithdrawals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation();
  const successMessage = location.state?.successMessage;

  useEffect(() => {
    fetch('/api/ledger')
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        setTransactions(data.transactions || []);
        setTotalDonations(data.total_donations || 0);
        setTotalWithdrawals(data.total_withdrawals || 0);
        setLoading(false);
      })
      .catch(error => {
        setError(error.message);
        setLoading(false);
      });
  }, []);

  const formatUser = (transaction) => {
    if (transaction.anonymous) {
      return 'Anonymous';
    }
    if (transaction.first_name && transaction.last_initial) {
      return `${transaction.first_name} ${transaction.last_initial}.`;
    }
    if (transaction.first_name) {
      return transaction.first_name;
    }
    return 'User'; // Fallback for older data or system transactions
  };

  if (loading) {
    return <div>Loading ledger...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  const netBalance = totalDonations - totalWithdrawals;
  return (
    <div>
      <h2>Ledger Page</h2>
      {successMessage && (
        <p style={{ color: 'green', border: '1px solid green', padding: '10px', borderRadius: '5px' }}>{successMessage}</p>
      )}
      <div style={{ border: '1px solid #ddd', padding: '15px', marginBottom: '20px', borderRadius: '5px', backgroundColor: '#f9f9f9' }}>
        <h3>Account Summary</h3>
        <p style={{ fontSize: '1.2em', margin: 0 }}>
          <strong>Total Donations Received:</strong>
          <span style={{ color: 'green', marginLeft: '10px' }}>
            ${totalDonations.toFixed(2)}
          </span>
        </p>
        <p style={{ fontSize: '1.2em', margin: '5px 0 0 0' }}>
          <strong>Total Withdrawals:</strong>
          <span style={{ color: 'red', marginLeft: '10px' }}>
            ${totalWithdrawals.toFixed(2)}
          </span>
        </p>
        <hr style={{ margin: '10px 0' }} />
        <p style={{ fontSize: '1.3em', margin: 0 }}>
          <strong>Net Balance:</strong>
          <span style={{ color: netBalance >= 0 ? 'blue' : 'red', marginLeft: '10px', fontWeight: 'bold' }}>
            ${netBalance.toFixed(2)}
          </span>
        </p>
      </div>
      <p>Here's a list of recent transactions:</p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid black' }}>
            <th style={{ textAlign: 'left', padding: '8px' }}>Date</th>
            <th style={{ textAlign: 'left', padding: '8px' }}>User</th>
            <th style={{ textAlign: 'left', padding: '8px' }}>Type</th>
            <th style={{ textAlign: 'right', padding: '8px' }}>Amount</th>
            <th style={{ textAlign: 'left', padding: '8px' }}>Description</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map(tx => (
            <tr key={tx.id} style={{ borderBottom: '1px solid #ccc' }}>
              <td style={{ padding: '8px' }}>{new Date(tx.timestamp).toLocaleString()}</td>
              <td style={{ padding: '8px' }}>{formatUser(tx)}</td>
              <td style={{ padding: '8px', textTransform: 'capitalize' }}>{tx.transaction_type}</td>
              <td style={{ padding: '8px', textAlign: 'right', color: tx.transaction_type === 'deposit' ? 'green' : 'red' }}>
                ${tx.amount.toFixed(2)}
              </td>
              <td style={{ padding: '8px' }}>{tx.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Ledger;