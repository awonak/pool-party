import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';

function Home({ user, setUser, onLogout }) {
  const [fundingPools, setFundingPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // This function is called on successful login from Google's side.
  // It then sends the credential to our backend for verification and session creation.
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
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        // Fetch funding pools
        const poolsResponse = await fetch('/api/funding-pools');
        if (!poolsResponse.ok) {
          throw new Error('Network response was not ok');
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
    return <div>Loading pools...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <div style={{ float: 'right', padding: '10px' }}>
        {user ? (
          <div>
            <span>Welcome, {user.first_name}!</span>
            <button onClick={onLogout} style={{ marginLeft: '10px' }}>Logout</button>
          </div>
        ) : (
          <GoogleLogin
            onSuccess={handleBackendLogin}
            onError={() => setError('Google Login Failed')}
            useOneTap
          />
        )}
      </div>
      <h2>Home Page</h2>
      <p>Welcome to Pool Party! Here are the funding pools:</p>
      {fundingPools.length > 0 ? (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {fundingPools.map(pool => (
            <li key={pool.id} style={{ marginBottom: '20px' }}>
              <div>
                <strong>{pool.name}</strong> - Current: ${pool.current_amount.toFixed(2)} / Goal: ${pool.goal_amount.toFixed(2)}
                {/* Only show the Edit link to moderators */}
                {user && user.is_moderator && (
                  <Link to={`/funding-pool-manager/${pool.id}`} style={{ marginLeft: '10px', fontSize: '0.9em' }}>
                    Edit
                  </Link>
                )}
              </div>
              <div style={{ border: '1px solid #ccc', padding: '2px', marginTop: '5px', width: '300px', backgroundColor: '#f0f0f0' }}>
                <div
                  style={{
                    width: `${Math.min((pool.current_amount / pool.goal_amount) * 100, 100)}%`,
                    backgroundColor: '#4caf50',
                    height: '24px',
                    lineHeight: '24px',
                    textAlign: 'center',
                    color: 'white',
                  }}
                >
                  {Math.round((pool.current_amount / pool.goal_amount) * 100)}%
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p>No funding pools available at the moment.</p>
      )}
    </div>
  );
}

export default Home;