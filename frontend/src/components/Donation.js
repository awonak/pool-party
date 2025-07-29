import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js';

// Material-UI Imports
import {
  Container,
  Paper,
  Box,
  Typography,
  TextField,
  InputAdornment,
  Checkbox,
  FormControlLabel,
  Divider,
  CircularProgress,
  Alert,
} from '@mui/material';

function Donation() {
  const navigate = useNavigate();
  const [{ isPending }] = usePayPalScriptReducer();
  
  // Component State
  const [fundingPools, setFundingPools] = useState([]);
  const [donationAmounts, setDonationAmounts] = useState({});
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  
  // Status State
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setPageLoading(true);
    fetch('/api/funding-pools')
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(data => {
        setFundingPools(data || []);
      })
      .catch(err => {
        setError(err.message);
      })
      .finally(() => {
        setPageLoading(false);
      });
  }, []);

  const handleDonationChange = (poolId, amount) => {
    // Allow empty string to clear the input, otherwise parse as float
    const numericAmount = amount === '' ? '' : parseFloat(amount);
    if (isNaN(numericAmount) && numericAmount !== '') return;
    setDonationAmounts({ ...donationAmounts, [poolId]: numericAmount });
  };

  const totalDonation = Object.values(donationAmounts).reduce((sum, amount) => sum + (Number(amount) || 0), 0);

  const createOrder = (data, actions) => {
    if (totalDonation <= 0) {
      setError("Please enter a donation amount greater than $0.00.");
      return Promise.reject(new Error("Invalid amount"));
    }
    setError(null); // Clear previous errors
    return actions.order.create({
      purchase_units: [{
        amount: { value: totalDonation.toFixed(2) },
      }],
    });
  };

  const onApprove = (data, actions) => {
    const allocations = Object.entries(donationAmounts)
      .filter(([, amount]) => Number(amount) > 0)
      .map(([poolId, amount]) => ({ funding_pool_id: parseInt(poolId, 10), amount: parseFloat(amount) }));

    return fetch('/api/donations/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderID: data.orderID, allocations, description, isAnonymous }),
    })
    .then(res => {
        if (!res.ok) {
            return res.json().then(err => { throw new Error(err.error || 'Donation capture failed.') });
        }
        return res.json();
    })
    .then(details => {
      const donorName = details.payer?.name?.given_name || 'friend';
      navigate('/ledger', { state: { successMessage: `Thank you for your donation, ${donorName}!` } });
    })
    .catch(err => {
      setError(err.message);
    });
  };

  if (pageLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading donation options...</Typography>
      </Box>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: { xs: 2, md: 4 } }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Make a Donation
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Choose how to allocate your donation across the funding pools.
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

        {fundingPools.length > 0 ? (
          <Box component="form" noValidate autoComplete="off">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              {fundingPools.map(pool => (
                <TextField
                  key={pool.id}
                  label={pool.name}
                  type="number"
                  value={donationAmounts[pool.id] || ''}
                  onChange={(e) => handleDonationChange(pool.id, e.target.value)}
                  placeholder="0.00"
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  inputProps={{ min: 0, step: "0.01" }}
                />
              ))}
            </Box>

            <Divider sx={{ my: 3 }} />

            <TextField
              fullWidth
              label="Add a note (optional)"
              multiline
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="How would you like your donation to be used?"
              sx={{ mb: 2 }}
            />
            
            <FormControlLabel
              control={
                <Checkbox
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                />
              }
              label="Make my donation anonymous"
            />
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: -1, mb: 3, ml: 4 }}>
                If checked, your name will not appear on the public ledger.
            </Typography>

            <Typography variant="h5" component="p" align="right" sx={{ fontWeight: 'bold' }}>
              {`Total: $${totalDonation.toFixed(2)}`}
            </Typography>

            <Box sx={{ mt: 2, minHeight: '50px' }}>
              {isPending ? (
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <CircularProgress />
                </Box>
              ) : (
                <PayPalButtons
                  createOrder={createOrder}
                  onApprove={onApprove}
                  onError={(err) => setError(err.message)}
                  forceReRender={[totalDonation, description, isAnonymous]} // Re-render buttons if these values change
                />
              )}
            </Box>
          </Box>
        ) : (
          <Alert severity="info">No funding pools are available for donation at this time.</Alert>
        )}
      </Paper>
    </Container>
  );
}

export default Donation;