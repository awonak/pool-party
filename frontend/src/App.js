import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import SiteContext from './context/SiteContext';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Box,
  CssBaseline,
} from '@mui/material';
import './App.css';
import Home from './components/Home';
import Donation from './components/Donation';
import FundingPoolManager from './components/FundingPoolManager';
import Ledger from './components/Ledger';
import Withdrawal from './components/Withdrawal';

function App() {
  const [user, setUser] = useState(null);
  const [siteConfig, setSiteConfig] = useState({
    site_title: 'Pool Party', // Default title while loading
    site_headline: 'Welcome! Browse and manage the funding pools below.', // Default headline
  });

  // Check for an active user session when the app loads
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          setUser(await response.json());
        }
      } catch (err) {
        // It's okay if this fails, it just means the user isn't logged in.
        console.error("Session check failed:", err);
      }
    };
    checkSession();
  }, []);

  // Fetch site-wide configuration when the app loads
  useEffect(() => {
    const fetchSiteConfig = async () => {
      try {
        const response = await fetch('/api/site-instance');
        if (response.ok) {
          const config = await response.json();
          setSiteConfig(config);
        } else {
          console.error("Failed to fetch site configuration, using defaults.");
        }
      } catch (err) {
        console.error("Error fetching site configuration:", err);
      }
    };
    fetchSiteConfig();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

    return (
    <SiteContext.Provider value={siteConfig}>
      <Router>
        <CssBaseline />
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              {siteConfig.site_title}
            </Typography>
            <Button color="inherit" component={Link} to="/">Home</Button>
            <Button color="inherit" component={Link} to="/donation">Donation</Button>
            <Button color="inherit" component={Link} to="/ledger">Ledger</Button>
            {user && user.is_moderator && (
              <>
                <Button color="inherit" component={Link} to="/funding-pool-manager">Manage Pools</Button>
                <Button color="inherit" component={Link} to="/withdrawal">Make Withdrawal</Button>
              </>
            )}
          </Toolbar>
        </AppBar>
        <Container component="main" sx={{ mt: 4, mb: 4 }}>
          <Box>
            <Routes>
              <Route path="/" element={<Home user={user} setUser={setUser} onLogout={handleLogout} />} />
              <Route path="/donation" element={<Donation />} />
              <Route path="/ledger" element={<Ledger />} />
              <Route path="/funding-pool-manager" element={<FundingPoolManager />} />
              <Route path="/funding-pool-manager/:id" element={<FundingPoolManager />} />
              <Route path="/withdrawal" element={<Withdrawal />} />
            </Routes>
          </Box>
        </Container>
      </Router>
    </SiteContext.Provider>
  );
}

export default App;