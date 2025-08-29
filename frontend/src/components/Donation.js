import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PayPalButtons, usePayPalScriptReducer, FUNDING } from '@paypal/react-paypal-js';
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
import { LoadingButton } from '@mui/lab';

function Donation({ user }) {
  const navigate = useNavigate();
  const [{ isPending }] = usePayPalScriptReducer();

  // Component State
  const [fundingPools, setFundingPools] = useState([]);
  const [donationAmounts, setDonationAmounts] = useState({});
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  // Status State
  const [pageLoading, setPageLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', severity: 'info' });

  // Moderator fields for external donation
  const [submittingExternal, setSubmittingExternal] = useState(false);

  // Constants
  const MINIMUM_DONATION = 10.00;
  const MAX_DESCRIPTION_LENGTH = 255;

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
        setMessage({ text: err.message, severity: 'error' });
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
  useEffect(() => {
    if (message.text) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [message]);

  const createOrder = (data, actions) => {
    if (totalDonation < MINIMUM_DONATION) {
      setMessage({ text: `The minimum donation amount is $${MINIMUM_DONATION.toFixed(2)}.`, severity: 'error' });
      return Promise.reject(new Error("Minimum donation amount not met."));
    }
    setMessage({ text: '', severity: 'info' }); // Clear previous errors
    return actions.order.create({
      purchase_units: [{
        amount: { value: totalDonation.toFixed(2) },
      }],
      application_context: {
        shipping_preference: 'NO_SHIPPING',
      },
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
      setMessage({ text: err.message, severity: 'error' });
    });
  };

  const handleSubmitExternalDonation = async () => {
    setMessage({ text: '', severity: 'info' });

    if (totalDonation < MINIMUM_DONATION) {
      setMessage({ text: `The minimum donation amount is $${MINIMUM_DONATION.toFixed(2)}.`, severity: 'error' });
      return;
    }
    // For external donations, description is required.
    if (!description.trim()) {
      setMessage({ text: "Description is required for external donations.", severity: 'error' });
      return;
    }

    setSubmittingExternal(true);

    const allocations = Object.entries(donationAmounts)
      .filter(([, amount]) => Number(amount) > 0)
      .map(([poolId, amount]) => ({ funding_pool_id: parseInt(poolId, 10), amount: parseFloat(amount) }));

    const payload = {
      allocations,
      description: description,
    };

    try {
      const response = await fetch('/api/donations/external', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to submit external donation.');
      }

      setMessage({ text: 'External donation recorded successfully!', severity: 'success' });
      // Reset form state after successful submission to prevent resubmission
      // and prepare for the next entry.
      setDonationAmounts({});
      setDescription('');
      setIsAnonymous(false);
    } catch (err) {
      setMessage({ text: err.message, severity: 'error' });
    } finally {
      setSubmittingExternal(false);
    }
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
          Choose how to allocate your donation across the funding pools. The minimum donation is $10.00.
        </Typography>

        {message.text && (
          <Alert
            severity={message.severity}
            sx={{ mb: 3 }}
            onClose={() => setMessage({ text: '', severity: 'info' })}
          >
            {message.text}
          </Alert>
        )}

        {fundingPools.length > 0 ? (
          <Box component="form" noValidate autoComplete="off">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mb: 2 }}>
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
              multiline
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={user?.is_moderator 
                ? "Description (Required for External Donation)" 
                : "How would you like your donation to be used? (optional)"}
              inputProps={{ maxLength: MAX_DESCRIPTION_LENGTH }}
              helperText={`${description.length}/${MAX_DESCRIPTION_LENGTH}`}
              error={description.length > MAX_DESCRIPTION_LENGTH}
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
                  disabledFunding={[FUNDING.PAYLATER]}
                  createOrder={createOrder}
                  onApprove={onApprove}
                  onError={(err) => setMessage({ text: err.message, severity: 'error' })}
                  forceReRender={[totalDonation, description, isAnonymous]} // Re-render buttons if these values change
                />
              )}
            </Box>

            {user?.is_moderator && (
              <>
                <Divider sx={{ my: 2, fontSize: '0.875rem' }}>OR</Divider>
                <LoadingButton
                  fullWidth
                  onClick={handleSubmitExternalDonation}
                  variant="contained"
                  color="secondary"
                  loading={submittingExternal}
                  disabled={totalDonation < MINIMUM_DONATION || !description.trim() || isPending}
                >
                  Record External Donation
                </LoadingButton>
              </>
            )}
          </Box>
        ) : (
          <Alert severity="info">No funding pools are available for donation at this time.</Alert>
        )}
      </Paper>
    </Container>
  );
}

export default Donation;