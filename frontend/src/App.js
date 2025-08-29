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
  useTheme,
  useMediaQuery,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import './App.css';
import Home from './components/Home';
import Donation from './components/Donation';
import FundingPoolManager from './components/FundingPoolManager';
import Ledger from './components/Ledger';
import Withdrawal from './components/Withdrawal';

function App() {
  const [user, setUser] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

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

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const navLinks = [
    { text: 'Home', path: '/' },
    { text: 'Donation', path: '/donation' },
    { text: 'Ledger', path: '/ledger' },
  ];

  const moderatorLinks = [
    { text: 'Manage Pools', path: '/funding-pool-manager' },
    { text: 'Make Withdrawal', path: '/withdrawal' },
  ];

    return (
    <SiteContext.Provider value={siteConfig}>
      <Router>
        <CssBaseline />
        <AppBar position="static">
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              {siteConfig.site_title}
            </Typography>
            {isMobile ? (
              <IconButton
                color="inherit"
                aria-label="open drawer"
                edge="end"
                onClick={handleDrawerToggle}
              >
                <MenuIcon />
              </IconButton>
            ) : (
              <Box>
                {navLinks.map((link) => (
                  <Button key={link.path} color="inherit" component={Link} to={link.path}>
                    {link.text}
                  </Button>
                ))}
                {user && user.is_moderator && moderatorLinks.map((link) => (
                  <Button key={link.path} color="inherit" component={Link} to={link.path}>
                    {link.text}
                  </Button>
                ))}
              </Box>
            )}
          </Toolbar>
        </AppBar>
        <Drawer
          anchor="right"
          open={drawerOpen}
          onClose={handleDrawerToggle}
        >
          <Box
            sx={{ width: 250 }}
            role="presentation"
            onClick={handleDrawerToggle}
            onKeyDown={handleDrawerToggle}
          >
            <List>
              {navLinks.map((link) => (
                <ListItem key={link.path} disablePadding>
                  <ListItemButton component={Link} to={link.path}>
                    <ListItemText primary={link.text} />
                  </ListItemButton>
                </ListItem>
              ))}
              {user && user.is_moderator && (
                <>
                  <Divider />
                  {moderatorLinks.map((link) => (
                    <ListItem key={link.path} disablePadding>
                      <ListItemButton component={Link} to={link.path}>
                        <ListItemText primary={link.text} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </>
              )}
            </List>
          </Box>
        </Drawer>
        <Container component="main" sx={{ mt: 4, mb: 4 }}>
          <Box>
            <Routes>
              <Route path="/" element={<Home user={user} setUser={setUser} onLogout={handleLogout} />} />
              <Route path="/donation" element={<Donation user={user} />} />
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