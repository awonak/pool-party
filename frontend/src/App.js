import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import Home from './components/Home';
import Donation from './components/Donation';
import FundingPoolManager from './components/FundingPoolManager';
import Ledger from './components/Ledger';
import Withdrawal from './components/Withdrawal';

function App() {
  const [user, setUser] = useState(null);

  // Check for an active session when the app loads
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

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

    return (
    <Router>
      <div>
        <nav>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/donation">Donation</Link></li>
            <li><Link to="/ledger">Ledger</Link></li>
            {user && user.is_moderator && (<>
              <li><Link to="/funding-pool-manager">Manage Pools</Link></li>
              <li><Link to="/withdrawal">Make Withdrawal</Link></li>
              </>
            )}
          </ul>
        </nav>
        <Routes>
          <Route path="/" element={<Home user={user} setUser={setUser} onLogout={handleLogout} />} />
          <Route path="/donation" element={<Donation />} />
          <Route path="/ledger" element={<Ledger />} />
          <Route path="/funding-pool-manager" element={<FundingPoolManager />} />
          <Route path="/funding-pool-manager/:id" element={<FundingPoolManager />} />
          <Route path="/withdrawal" element={<Withdrawal />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;