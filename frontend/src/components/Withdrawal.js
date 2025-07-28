import React, { useState, useEffect } from 'react';

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

  // Function to handle changes in withdrawal input fields
  const handleAmountChange = (poolId, amount) => {
    const newAmounts = { ...withdrawalAmounts, [poolId]: amount };
    // Remove the entry if the amount is empty or zero to keep the state clean
    if (!amount || Number(amount) === 0) {
      delete newAmounts[poolId];
    }
    setWithdrawalAmounts(newAmounts);
  };

  // Calculate the total withdrawal amount
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
      // Reset form
      setWithdrawalAmounts({});
      setDescription('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (pageLoading) {
    return <div>Loading funding pools...</div>;
  }

  if (apiError) {
    return <div>Error: {apiError}</div>;
  }

  return (
    <div>
      <h2>Moderator - Make a Withdrawal</h2>
      <p>Record a withdrawal from funding pools for purchases.</p>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {successMessage && <p style={{ color: 'green' }}>{successMessage}</p>}

      <form onSubmit={handleSubmit}>
        <h3>Select amounts to withdraw from each pool:</h3>
        {fundingPools.map(pool => (
          <div key={pool.id} style={{ marginBottom: '10px' }}>
            <label htmlFor={`withdrawal-${pool.id}`}>
              {pool.name} (Available: ${pool.current_amount.toFixed(2)})
            </label>
            <input
              type="number"
              id={`withdrawal-${pool.id}`}
              min="0"
              max={pool.current_amount.toFixed(2)}
              step="0.01"
              value={withdrawalAmounts[pool.id] || ''}
              onChange={(e) => handleAmountChange(pool.id, e.target.value)}
              style={{ marginLeft: '10px' }}
            />
          </div>
        ))}
        <hr />
        <div>
          <label htmlFor="withdrawal-description"><strong>Description (Required):</strong></label>
          <br />
          <textarea
            id="withdrawal-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., Purchased new keg for Kegerator A"
            rows="3"
            required
            style={{ width: '400px', marginTop: '5px' }}
          />
        </div>
        <h3 style={{ marginTop: '20px' }}>Total Withdrawal: ${totalWithdrawal.toFixed(2)}</h3>
        <button type="submit" disabled={loading || totalWithdrawal <= 0 || !description.trim()}>
          {loading ? 'Recording...' : 'Record Withdrawal'}
        </button>
      </form>
    </div>
  );
}

export default Withdrawal;