import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import styles from "./FundingPoolManager.module.css";

function FundingPoolManager() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [initialLoading, setInitialLoading] = useState(isEditMode); // For fetching data in edit mode

  useEffect(() => {
    if (isEditMode) {
      fetch(`/api/funding-pools/${id}`)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Failed to fetch funding pool data.");
          }
          return response.json();
        })
        .then((data) => {
          setName(data.name);
          setDescription(data.description || "");
          setGoalAmount(data.goal_amount.toString());
        })
        .catch((err) => {
          setError(err.message);
        })
        .finally(() => {
          setInitialLoading(false);
        });
    }
  }, [id, isEditMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage("");

    const poolData = {
      name: name,
      description: description,
      goal_amount: parseFloat(goalAmount), // Match Go backend struct tag
    };

    const endpoint = isEditMode ? `/api/funding-pools/${id}` : "/api/funding-pools";

    try {
      const response = await fetch(endpoint, {
        method: isEditMode ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(poolData),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(
          errData.error ||
            `Failed to ${isEditMode ? "update" : "create"} funding pool.`
        );
      }

      const resultPool = await response.json();
      if (isEditMode) {
        setSuccessMessage(`Successfully updated pool: ${resultPool.name}`);
        // Optional: redirect back to the home page after a successful update
        setTimeout(() => navigate("/"), 2000);
      } else {
        setSuccessMessage(`Successfully created pool: ${resultPool.name}`);
        // Reset the form only on successful creation
        setName("");
        setDescription("");
        setGoalAmount("");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return <div>Loading pool data...</div>;
  }

  return (
    <div className={styles.formContainer}>
      <h2>{isEditMode ? "Edit Funding Pool" : "Funding Pool Manager"}</h2>
      <p>
        {isEditMode
          ? "Modify the details of the funding pool."
          : "Add a new funding pool here."}
      </p>
      <form onSubmit={handleSubmit}>
        <h3>{isEditMode ? `Editing: ${name}` : "Add New Funding Pool"}</h3>

        {error && <p className={styles.errorText}>{error}</p>}
        {successMessage && <p className={styles.successMessage}>{successMessage}</p>}

        <div className={styles.formGroup}>
          <label htmlFor="name">Pool Name</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g., Kegerator A"
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="description">Description (Optional)</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g., For funding the main office kegerator"
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="goalAmount">Goal Amount</label>
          <input
            type="number"
            id="goalAmount"
            value={goalAmount}
            onChange={(e) => setGoalAmount(e.target.value)}
            required
            min="0"
            step="0.01"
            placeholder="e.g., 150.00"
          />
        </div>
        <button
          type="submit"
          disabled={loading || initialLoading}
          className={styles.submitButton}
        >
          {loading
            ? isEditMode ? "Updating..." : "Creating..."
            : isEditMode ? "Update Pool" : "Create Pool"}
        </button>
      </form>
    </div>
  );
}

export default FundingPoolManager;