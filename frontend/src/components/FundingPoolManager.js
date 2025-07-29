import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

// Material-UI Imports
import {
  Container,
  Paper,
  Box,
  Typography,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
} from "@mui/material";
import { LoadingButton } from "@mui/lab"; // For a button with a loading state

function FundingPoolManager() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [goalAmount, setGoalAmount] = useState("");

  // Status State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [initialLoading, setInitialLoading] = useState(isEditMode);

  useEffect(() => {
    if (isEditMode) {
      setInitialLoading(true);
      fetch(`/api/funding-pools/${id}`)
        .then((response) => {
          if (!response.ok) throw new Error("Failed to fetch funding pool data.");
          return response.json();
        })
        .then((data) => {
          setName(data.name);
          setDescription(data.description || "");
          setGoalAmount(data.goal_amount.toString());
        })
        .catch((err) => setError(err.message))
        .finally(() => setInitialLoading(false));
    }
  }, [id, isEditMode]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage("");

    const poolData = {
      name,
      description,
      goal_amount: parseFloat(goalAmount),
    };

    const endpoint = isEditMode ? `/api/funding-pools/${id}` : "/api/funding-pools";
    const method = isEditMode ? "PUT" : "POST";

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(poolData),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Failed to ${isEditMode ? "update" : "create"} pool.`);
      }

      const resultPool = await response.json();
      setSuccessMessage(`Successfully ${isEditMode ? "updated" : "created"} pool: ${resultPool.name}`);
      
      if (isEditMode) {
        setTimeout(() => navigate("/"), 2000);
      } else {
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
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading pool data...</Typography>
      </Box>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      <Paper elevation={3} sx={{ p: { xs: 2, md: 4 } }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {isEditMode ? "Edit Funding Pool" : "Create Funding Pool"}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          {isEditMode
            ? `Use this form to modify the details of "${name}".`
            : "Use this form to add a new funding pool to the system."}
        </Typography>

        <Box component="form" onSubmit={handleSubmit} noValidate>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TextField
              label="Pool Name"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              autoFocus
            />
            <TextField
              label="Description (Optional)"
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={4}
              fullWidth
            />
            <TextField
              label="Goal Amount"
              id="goalAmount"
              type="number"
              value={goalAmount}
              onChange={(e) => setGoalAmount(e.target.value)}
              required
              fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              inputProps={{ min: 0, step: "0.01" }}
            />
          </Box>
          <LoadingButton
            type="submit"
            fullWidth
            variant="contained"
            loading={loading}
            sx={{ mt: 3, py: 1.5 }}
          >
            {isEditMode ? "Update Pool" : "Create Pool"}
          </LoadingButton>
        </Box>
      </Paper>
    </Container>
  );
}

export default FundingPoolManager;