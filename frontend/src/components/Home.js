import React, { useState, useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useSiteConfig } from '../context/SiteContext';

// Material-UI Imports
import {
  Container,
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  LinearProgress,
  Link as MuiLink,
} from '@mui/material';

function Home({ user, setUser, onLogout }) {
  const [fundingPools, setFundingPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const siteConfig = useSiteConfig();

  const handleBackendLogin = async (credentialResponse) => {
    try {
      const res = await fetch('/api/auth/google/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: credentialResponse.credential,
        }),
      });

      if (!res.ok) {
        throw new Error('Google login failed on the backend.');
      }

      const userData = await res.json();
      setUser(userData);
      setError(null); // Clear previous errors on successful login
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        const poolsResponse = await fetch('/api/funding-pools');
        if (!poolsResponse.ok) {
          throw new Error('Failed to fetch funding pools.');
        }
        setFundingPools((await poolsResponse.json()) || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading pools...</Typography>
      </Box>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      {/* User Login/Logout Section */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        {user ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography>Welcome, {user.first_name}!</Typography>
            <Button variant="outlined" onClick={onLogout}>Logout</Button>
          </Box>
        ) : (
          <GoogleLogin
            onSuccess={handleBackendLogin}
            onError={() => setError('Google Login Failed')}
            useOneTap
            color="secondary"
          />
        )}
      </Box>
      
      {/* Display General Errors */}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}


      {/* Page Header */}
      <Typography variant="h4" component="h1" gutterBottom>
        Funding Pools
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        {siteConfig.site_headline}
      </Typography>

      {/* Funding Pools List */}
      {fundingPools.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {fundingPools.map(pool => {
            const goalAmount = pool.goal_amount;
            const currentAmount = pool.current_amount;
            const isGoalMet = currentAmount >= goalAmount;

            // Calculate progress percentage. Can go above 100%.
            const progressPercent = goalAmount > 0 ? (currentAmount / goalAmount) * 100 : 100;

            return (
              <Card key={pool.id} variant="outlined">
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" component="div">
                      {pool.name}
                    </Typography>
                    {user && user.is_moderator && (
                      <MuiLink component={RouterLink} to={`/funding-pool-manager/${pool.id}`} underline="hover">
                        Edit
                      </MuiLink>
                    )}
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {pool.description}
                    </Typography>
                  </Box>

                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {`$${currentAmount.toFixed(2)} / $${goalAmount.toFixed(2)}`}
                  </Typography>

                  {/* Progress Bar with Label and Goal Notch */}
                  <Box sx={{ mt: 1.5, position: 'relative' }}>
                    <Box sx={{ position: 'relative' }}>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(progressPercent, 100)} // Bar visual caps at 100%
                        color={isGoalMet ? 'success' : 'secondary'}
                        sx={{ height: 24, borderRadius: 1 }}
                      />
                      <Box
                        sx={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          width: '100%',
                          height: '100%',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 'bold', color: 'white' }}>
                          {`${Math.round(progressPercent)}%`}
                        </Typography>
                      </Box>
                    </Box>
                    {/* Goal Notch: Only shows if funding exceeds the goal */}
                    {isGoalMet && currentAmount > 0 && (
                      <Box
                        title={`Goal: $${goalAmount.toFixed(2)}`}
                        sx={{
                          position: 'absolute',
                          left: `${(goalAmount / currentAmount) * 100}%`,
                          top: 0,
                          bottom: 0,
                          width: '3px',
                          bgcolor: 'rgba(0, 0, 0, 0.4)',
                          zIndex: 1,
                        }}
                      />
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      ) : (
        <Alert severity="info">No funding pools available at the moment.</Alert>
      )}

      {/* Donate Button */}
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <Button
          component={RouterLink}
          to="/donation"
          variant="contained"
          color="secondary"
          size="large"
        >
          Make a Donation
        </Button>
      </Box>
    </Container>
  );
}

export default Home;