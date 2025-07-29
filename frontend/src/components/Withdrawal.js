import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';

function Withdrawal() {
  const [fundingPools, setFundingPools] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  const [withdrawalAmounts, setWithdrawalAmounts] = useState({});
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/funding-pools')
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.json();
      })
      .then(data => {
        setFundingPools(data || []);
        setPageLoading(false);
      })
      .catch(error => {
        setApiError(error.message);
        setPageLoading(false);
      });
  }, []);

  const handleAmountChange = (poolId, amount) => {
    const newAmounts = { ...withdrawalAmounts, [poolId]: amount };
    if (!amount || Number(amount) === 0) {
      delete newAmounts[poolId];
    }
    setWithdrawalAmounts(newAmounts);
  };

  const totalWithdrawal = Object.values(withdrawalAmounts).reduce((sum, amount) => sum + (Number(amount) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');

    if (totalWithdrawal <= 0) {
      setError('Please enter an amount to withdraw.');
      return;
    }
    if (!description.trim()) {
      setError('A description for the withdrawal is required.');
      return;
    }

    for (const poolId in withdrawalAmounts) {
      const pool = fundingPools.find(p => p.id.toString() === poolId);
      if (pool && parseFloat(withdrawalAmounts[poolId]) > pool.current_amount) {
        setError(`Cannot withdraw more than available for ${pool.name}.`);
        return;
      }
    }

    setLoading(true);

    const allocations = Object.entries(withdrawalAmounts)
      .filter(([, amount]) => Number(amount) > 0)
      .map(([poolId, amount]) => ({
        funding_pool_id: parseInt(poolId, 10),
        amount: parseFloat(amount),
      }));

    const withdrawalData = {
      allocations,
      description,
    };

    try {
      const response = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withdrawalData),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to record withdrawal.');
      }

      setSuccessMessage(`Successfully recorded withdrawal of $${totalWithdrawal.toFixed(2)}.`);
      setWithdrawalAmounts({});
      setDescription('');
      // TODO: Re-fetch funding pool data to show updated amounts
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading funding pools...</Typography>
      </Box>
    );
  }

  if (apiError) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
        <Alert severity="error">Error: {apiError}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h4" component="h2" gutterBottom>
        Moderator - Make a Withdrawal
      </Typography>
      <Typography variant="body1" paragraph>
        Record a withdrawal from funding pools for purchases.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}

      <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
        <Typography variant="h5" component="h3" gutterBottom>
          Select amounts to withdraw from each pool:
        </Typography>
        <List>
          {fundingPools.map(pool => (
            <ListItem key={pool.id} disableGutters sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <ListItemText
                primary={`${pool.name} (Available: $${pool.current_amount.toFixed(2)})`}
                sx={{ flexGrow: 1 }}
              />
              <TextField
                type="number"
                id={`withdrawal-${pool.id}`}
                inputProps={{ min: "0", max: pool.current_amount.toFixed(2), step: "0.01" }}
                value={withdrawalAmounts[pool.id] || ''}
                onChange={(e) => handleAmountChange(pool.id, e.target.value)}
                placeholder="$0.00"
                variant="outlined"
                size="small"
                sx={{ width: 150 }}
              />
            </ListItem>
          ))}
        </List>
        <Divider sx={{ my: 3 }} />
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" component="label" htmlFor="withdrawal-description" gutterBottom>
            Description (Required):
          </Typography>
          <TextField
            id="withdrawal-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Purchased new keg for Kegerator A"
            multiline
            rows={3}
            fullWidth
            required
            variant="outlined"
            sx={{ mt: 1 }}
          />
        </Box>
        <Typography variant="h5" component="h3" sx={{ mt: 3, mb: 3, textAlign: 'right' }}>
          Total Withdrawal: ${totalWithdrawal.toFixed(2)}
        </Typography>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          disabled={loading || totalWithdrawal <= 0 || !description.trim()}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {loading ? 'Recording...' : 'Record Withdrawal'}
        </Button>
      </Box>
    </Box>
  );
}

export default Withdrawal;