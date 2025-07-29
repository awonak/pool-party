import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import styles from './Home.module.css';

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
      <div className={styles.userBox}>
        {user ? (
          <div>
            <span>Welcome, {user.first_name}!</span>
            <button onClick={onLogout} className={styles.logoutButton}>Logout</button>
          </div>
        ) : (
          <GoogleLogin
            onSuccess={handleBackendLogin}
            onError={() => setError('Google Login Failed')}
            useOneTap
          />
        )}
      </div>
      <h2>Funding Pools</h2>
      <p>Welcome to Pool Party! Here are the funding pools:</p>
      {fundingPools.length > 0 ? (
        <ul className={styles.poolList}>
          {fundingPools.map(pool => (
            <li key={pool.id} className={styles.poolItem}>
              <div>
                <strong>{pool.name}</strong> - Current: ${pool.current_amount.toFixed(2)} / Goal: ${pool.goal_amount.toFixed(2)}
                {/* Only show the Edit link to moderators */}
                {user && user.is_moderator && (
                  <Link to={`/funding-pool-manager/${pool.id}`} className={styles.editLink}>
                    Edit
                  </Link>
                )}
              </div>
              <div className={styles.progressBarContainer}>
                {pool.current_amount > pool.goal_amount && (
                  <div
                    className={styles.goalNotch}
                    style={{
                      left: `${(pool.goal_amount / pool.current_amount) * 100}%`,
                    }}
                    title={`Goal: $${pool.goal_amount.toFixed(2)}`}
                  ></div>
                )}
                <div
                  className={styles.progressBarFill}
                  style={{
                    width: `${(pool.current_amount / Math.max(pool.goal_amount, pool.current_amount)) * 100}%`,
                    backgroundColor: pool.current_amount >= pool.goal_amount ? '#28a745' : '#007bff',
                  }}
                >
                  {pool.goal_amount > 0 ? `${Math.round((pool.current_amount / pool.goal_amount) * 100)}%` : '100%'}
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