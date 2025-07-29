import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import styles from './Donation.module.css';

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
    setError(null); // Clear previous errors
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
    .then(res => {
        if (!res.ok) {
            return res.json().then(err => { throw new Error(err.error || 'Donation capture failed.') });
        }
        return res.json();
    })
    .then(details => {
      const donorName = details.payer && details.payer.name ? details.payer.name.given_name : 'friend';
      navigate('/ledger', { state: { successMessage: `Thank you for your donation, ${donorName}!` } });
    })
    .catch(err => {
        // Display error from our backend to the user
        setError(err.message);
    });
  };

  if (pageLoading) {
    return <div>Loading donation options...</div>;
  }

  if (error) {
    // Still render the donation form even if there's an error from a previous action
    // but show the error message. A full-page error is only for initial load failure.
    if (pageLoading) return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h2>Make a Donation</h2>
      <p>Choose how to allocate your donation across the funding pools.</p>
      {error && <p className={styles.errorText}>{error}</p>}
      {fundingPools.length > 0 ? (
        <>
          {fundingPools.map(pool => (
            <div key={pool.id} className={styles.poolInputContainer}>
              <label htmlFor={`donation-${pool.id}`}>{pool.name}:</label>
              <input
                type="number"
                min="0"
                step="0.01"
                id={`donation-${pool.id}`}
                value={donationAmounts[pool.id] || ''}
                onChange={(e) => handleDonationChange(pool.id, e.target.value)}
                placeholder="$0.00"
              />
            </div>
          ))}
          <hr className={styles.divider} />
          <div className={styles.anonymousContainer}>
            <input
              type="checkbox"
              id="anonymous-donation"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
            />
            <label htmlFor="anonymous-donation" className={styles.anonymousLabel}>
              Make my donation anonymous
            </label>
            <p className={styles.anonymousHelpText}>
              If checked, your name will not appear on the public ledger.
            </p>
          </div>
          <div className={styles.descriptionContainer}>
            <label htmlFor="donation-description">Add a note (optional):</label>
            <br />
            <textarea
              id="donation-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="How would you like your donation to be used?"
              rows="3"
              className={styles.descriptionTextarea}
            />
          </div>
          <h3 className={styles.totalDonation}>Total Donation: ${totalDonation.toFixed(2)}</h3>
          <div className={styles.paypalContainer}>
            {isPending ? <div>Loading PayPal...</div> : <PayPalButtons createOrder={createOrder} onApprove={onApprove} />}
          </div>
        </>
      ) : (
        <p>No funding pools are available for donation at this time.</p>
      )}
    </div>
  );
}

export default Donation;