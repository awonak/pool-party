import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import styles from './Ledger.module.css';

function Ledger() {
  const [transactions, setTransactions] = useState([]);
  const [totalDonations, setTotalDonations] = useState(0);
  const [totalWithdrawals, setTotalWithdrawals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'deposit', 'withdrawal'
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

  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'all') return true;
    return tx.transaction_type === filter;
  });

  const netBalance = totalDonations - totalWithdrawals;
  return (
    <div>
      <h2>Ledger Page</h2>
      {successMessage && (
        <p className={styles.successMessage}>{successMessage}</p>
      )}
      <div className={styles.summaryBox}>
        <h3>Account Summary</h3>
        <p className={styles.summaryRow}>
          <strong>Total Donations Received:</strong>
          <span className={styles.totalDonations}>
            ${totalDonations.toFixed(2)}
          </span>
        </p>
        <p className={styles.summaryRow}>
          <strong>Total Withdrawals:</strong>
          <span className={styles.totalWithdrawals}>
            ${totalWithdrawals.toFixed(2)}
          </span>
        </p>
        <hr className={styles.summaryDivider} />
        <p className={styles.netBalance}>
          <strong>Net Balance:</strong>
          <span className={`${styles.netBalanceValue} ${netBalance >= 0 ? styles.positiveBalance : styles.negativeBalance}`}>
            ${netBalance.toFixed(2)}
          </span>
        </p>
      </div>
      <h3>Transaction History</h3>
      <div className={styles.filterContainer}>
        <label htmlFor="filter-type">Filter by type: </label>
        <select
          id="filter-type"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All</option>
          <option value="deposit">Deposits</option>
          <option value="withdrawal">Withdrawals</option>
        </select>
      </div>
      <table className={styles.transactionTable}>
        <thead>
          <tr className={styles.tableHeader}>
            <th className={styles.tableHeaderCell}>Date</th>
            <th className={styles.tableHeaderCell}>User</th>
            <th className={styles.tableHeaderCell}>Type</th>
            <th className={styles.tableHeaderCellRight}>Amount</th>
            <th className={styles.tableHeaderCell}>Description</th>
          </tr>
        </thead>
        <tbody>
          {filteredTransactions.map(tx => (
            <tr key={tx.id} className={styles.tableRow}>
              <td className={styles.tableCell}>{new Date(tx.timestamp).toLocaleString()}</td>
              <td className={styles.tableCell}>{formatUser(tx)}</td>
              <td className={`${styles.tableCell} ${styles.transactionType}`}>{tx.transaction_type}</td>
              <td className={`${styles.tableCellRight} ${tx.transaction_type === 'deposit' ? styles.depositAmount : styles.withdrawalAmount}`}>
                ${tx.amount.toFixed(2)}
              </td>
              <td className={styles.tableCell}>{tx.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Ledger;