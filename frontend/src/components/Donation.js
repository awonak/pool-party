import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js';

function Donation() {
  const navigate = useNavigate();
  const [fundingPools, setFundingPools] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState(null);
  const [{ isPending }] = usePayPalScriptReducer();

  // State to store donation amounts for each pool
  const [donationAmounts, setDonationAmounts] = useState({});
  const [description, setDescription] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

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
        setError(error.message);
        setPageLoading(false);
      });
  }, []);

  // Function to handle changes in donation input fields
  const handleDonationChange = (poolId, amount) => {
    setDonationAmounts({ ...donationAmounts, [poolId]: amount });
  };

  // Calculate the total donation amount
  const totalDonation = Object.values(donationAmounts).reduce((sum, amount) => sum + (Number(amount) || 0), 0);

  const createOrder = (data, actions) => {
    // Basic validation before creating an order
    if (totalDonation <= 0) {
      setError("Please enter a donation amount.");
      return;
    }
    return actions.order.create({
      purchase_units: [{
        amount: {
          value: totalDonation.toFixed(2),
        },
      }],
    });
  };

  const onApprove = (data, actions) => {
    // This function is called when the user approves the payment on PayPal.
    // We now need to send the orderID and our allocation data to our backend for verification.
    const allocations = Object.entries(donationAmounts)
      .filter(([, amount]) => Number(amount) > 0)
      .map(([poolId, amount]) => ({ funding_pool_id: parseInt(poolId, 10), amount: parseFloat(amount) }));

    return fetch('/api/donations/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderID: data.orderID, allocations, description, isAnonymous }),
    })
    .then(res => res.json())
    .then(details => {
      navigate('/ledger', { state: { successMessage: `Thank you for your donation, ${details.payer.name.given_name}!` } });
    });
  };

  if (pageLoading) {
    return <div>Loading donation options...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h2>Donation Page</h2>
      <p>This is the donation page where users can donate to specific funding pools.</p>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {fundingPools.length > 0 ? (
        <>
          {fundingPools.map(pool => (
            <div key={pool.id}>
              <label htmlFor={`donation-${pool.id}`}>{pool.name}:</label>
              <input
                type="number"
                min="0"
                step="0.01"
                id={`donation-${pool.id}`}
                value={donationAmounts[pool.id] || ''}
                onChange={(e) => handleDonationChange(pool.id, e.target.value)}
              />
            </div>
          ))}
          <hr />
          <div style={{ marginBottom: '15px' }}>
            <input
              type="checkbox"
              id="anonymous-donation"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
            />
            <label htmlFor="anonymous-donation" style={{ marginLeft: '5px' }}>
              Make my donation anonymous
            </label>
            <p style={{ fontSize: '0.8em', color: '#666', margin: '5px 0 0 0' }}>
              If checked, your name will not appear on the public ledger.
            </p>
          </div>
          <div>
            <label htmlFor="donation-description">Add a note (optional):</label>
            <br />
            <textarea
              id="donation-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="How would you like your donation to be used?"
              rows="3"
              style={{ width: '300px', marginTop: '5px' }}
            />
          </div>
          <h3>Total Donation: ${totalDonation.toFixed(2)}</h3>
          {isPending ? <div>Loading PayPal...</div> : <PayPalButtons createOrder={createOrder} onApprove={onApprove} />}
        </>
      ) : (
        <p>No funding pools are available for donation at this time.</p>
      )}
    </div>
  );
}

export default Donation;