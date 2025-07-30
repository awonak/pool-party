import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Material-UI Imports
import {
  Container,
  Paper,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Chip,
} from '@mui/material';

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
    setLoading(true);
    fetch('/api/ledger')
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(data => {
        setTransactions(data.transactions || []);
        setTotalDonations(data.total_donations || 0);
        setTotalWithdrawals(data.total_withdrawals || 0);
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);
  
  const formatUser = (transaction) => {
    if (transaction.anonymous) return 'Anonymous';
    if (transaction.first_name && transaction.last_initial) return `${transaction.first_name} ${transaction.last_initial}.`;
    if (transaction.first_name) return transaction.first_name;
    return 'User';
  };

  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'all') return true;
    return tx.transaction_type === filter;
  });

  const netBalance = totalDonations - totalWithdrawals;

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading ledger...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">Error: {error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Ledger
      </Typography>

      {successMessage && (
        <Alert severity="success" sx={{ mb: 4 }}>
          {successMessage}
        </Alert>
      )}

      {/* Account Summary */}
      <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          Account Summary
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', my: 1 }}>
          <Typography>Total Donations Received:</Typography>
          <Typography sx={{ fontWeight: 'bold', color: 'success.main' }}>
            ${totalDonations.toFixed(2)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', my: 1 }}>
          <Typography>Total Withdrawals:</Typography>
          <Typography sx={{ fontWeight: 'bold', color: 'warning.main' }}>
            ${totalWithdrawals.toFixed(2)}
          </Typography>
        </Box>
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
          <Typography variant="h6">Net Balance:</Typography>
          <Typography variant="h6" sx={{ color: netBalance >= 0 ? 'success.main' : 'warning.main' }}>
            ${netBalance.toFixed(2)}
          </Typography>
        </Box>
      </Paper>

      {/* Transaction History */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" component="h2">
          Transaction History
        </Typography>
        <FormControl variant="outlined" sx={{ minWidth: 150 }}>
          <InputLabel id="filter-type-label">Filter by type</InputLabel>
          <Select
            labelId="filter-type-label"
            id="filter-type"
            value={filter}
            label="Filter by type"
            onChange={(e) => setFilter(e.target.value)}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="deposit">Deposits</MenuItem>
            <MenuItem value="withdrawal">Withdrawals</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <TableContainer component={Paper}>
        <Table aria-label="transaction ledger">
          <TableHead>
            <TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 'bold' } }}>
              <TableCell>Date</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Amount</TableCell>
              <TableCell>Description</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredTransactions.map((tx) => (
              <TableRow key={tx.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                <TableCell>{new Date(tx.timestamp).toLocaleString()}</TableCell>
                <TableCell>{formatUser(tx)}</TableCell>
                <TableCell>
                  <Chip
                    label={tx.transaction_type === 'deposit' ? 'donation' : 'purchase'}
                    color={tx.transaction_type === 'deposit' ? 'success' : 'warning'}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell align="right" sx={{ color: tx.transaction_type === 'deposit' ? 'success' : 'warning' }}>
                  ${tx.amount.toFixed(2)}
                </TableCell>
                <TableCell>{tx.description}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
}

export default Ledger;