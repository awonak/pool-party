package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"math"
	"net/http"
	"pool-party-api/models"
	"pool-party-api/paypal"
	"strconv"
)

// CaptureDonationRequest is the expected request body for capturing a donation.
type CaptureDonationRequest struct {
	OrderID     string                     `json:"orderID"`
	Allocations []models.AllocationRequest `json:"allocations"`
	Description string                     `json:"description,omitempty"`
	IsAnonymous bool                       `json:"isAnonymous"`
}

// ExternalDonationRequest is the expected request body for creating an external donation.
type ExternalDonationRequest struct {
	Allocations []models.AllocationRequest `json:"allocations"`
	Description string                     `json:"description"`
}

// LedgerEntryData is a struct for passing all necessary data to create a ledger entry and its allocations.
type LedgerEntryData struct {
	TransactionID   sql.NullString
	Amount          float64
	TransactionType string
	UserGoogleID    sql.NullString
	FirstName       sql.NullString
	LastInitial     sql.NullString
	Anonymous       bool
	Description     sql.NullString
	Allocations     []models.AllocationRequest
}

// CreateLedgerEntriesInTx is a helper function to record a transaction and its allocations in the database
// using an existing transaction. It does not commit or rollback the transaction.
func (env *APIEnv) CreateLedgerEntriesInTx(ctx context.Context, tx *sql.Tx, data LedgerEntryData) (int, error) {
	var ledgerID int
	ledgerQuery := `
		INSERT INTO ledger (transaction_id, amount, transaction_type, user_google_id, first_name, last_initial, anonymous, description)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id`
	err := tx.QueryRowContext(ctx, ledgerQuery, data.TransactionID, data.Amount, data.TransactionType, data.UserGoogleID, data.FirstName, data.LastInitial, data.Anonymous, data.Description).Scan(&ledgerID)
	if err != nil {
		return 0, err
	}

	for _, alloc := range data.Allocations {
		if alloc.Amount > 0 {
			if _, err := tx.ExecContext(ctx, "INSERT INTO allocation (ledger_id, funding_pool_id, amount) VALUES ($1, $2, $3)", ledgerID, alloc.FundingPoolID, alloc.Amount); err != nil {
				return 0, err
			}
		}
	}

	return ledgerID, nil
}

// createLedgerEntries is a wrapper for CreateLedgerEntriesInTx that handles its own transaction.
func (env *APIEnv) createLedgerEntries(ctx context.Context, data LedgerEntryData) (int, error) {
	tx, err := env.DB.BeginTx(ctx, nil)
	if err != nil {
		log.Printf("Failed to start database transaction: %v", err)
		return 0, err
	}
	defer tx.Rollback()

	ledgerID, err := env.CreateLedgerEntriesInTx(ctx, tx, data)
	if err != nil {
		return 0, err
	}

	return ledgerID, tx.Commit()
}

// CaptureDonation verifies a PayPal order, captures the payment, and records the transaction.
func (env *APIEnv) CaptureDonation(w http.ResponseWriter, r *http.Request) {
	var req CaptureDonationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.OrderID == "" {
		respondError(w, http.StatusBadRequest, "Missing orderID")
		return
	}

	// Create a new PayPal client
	ppClient, err := paypal.NewClient()
	if err != nil {
		log.Printf("Error creating PayPal client: %v", err)
		respondError(w, http.StatusInternalServerError, "PayPal client configuration error")
		return
	}

	// Get an access token
	accessToken, err := ppClient.GetAccessToken(r.Context())
	if err != nil {
		log.Printf("Error getting PayPal access token: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to authenticate with PayPal")
		return
	}

	// Capture the order
	captureResponse, err := ppClient.CaptureOrder(r.Context(), req.OrderID, accessToken)
	if err != nil {
		log.Printf("Error capturing PayPal order %s: %v", req.OrderID, err)
		respondError(w, http.StatusInternalServerError, "Failed to capture PayPal payment")
		return
	}

	// Validate the capture was successful
	if captureResponse.Status != "COMPLETED" {
		respondError(w, http.StatusInternalServerError, "PayPal payment not completed")
		log.Printf("PayPal order %s status is %s, not COMPLETED", req.OrderID, captureResponse.Status)
		return
	}

	// Extract captured amount from PayPal response
	if len(captureResponse.PurchaseUnits) == 0 || len(captureResponse.PurchaseUnits[0].Payments.Captures) == 0 {
		respondError(w, http.StatusInternalServerError, "Invalid PayPal capture response")
		log.Printf("PayPal order %s has no purchase units or captures", req.OrderID)
		return
	}

	capturedAmountStr := captureResponse.PurchaseUnits[0].Payments.Captures[0].Amount.Value
	capturedAmount, err := strconv.ParseFloat(capturedAmountStr, 64)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Invalid amount in PayPal response")
		log.Printf("Could not parse captured amount '%s' for order %s: %v", capturedAmountStr, req.OrderID, err)
		return
	}

	// Calculate total from frontend allocations
	var totalAllocation float64
	for _, alloc := range req.Allocations {
		if alloc.Amount < 0 {
			respondError(w, http.StatusBadRequest, "Donation amounts cannot be negative.")
			return
		}
		totalAllocation += alloc.Amount
	}

	// Security Check: Verify that the amount captured by PayPal matches the
	// total allocation amount from the frontend. Use a small tolerance for float comparison.
	if math.Abs(capturedAmount-totalAllocation) > 0.01 {
		// This is a critical security failure. It might indicate tampering.
		// We should not proceed and should flag this transaction for review.
		// In a real-world scenario, you would have a more robust process for this,
		// potentially involving an automated refund.
		log.Printf("CRITICAL: Amount mismatch for order %s. PayPal: %.2f, Frontend: %.2f",
			req.OrderID, capturedAmount, totalAllocation)
		respondError(w, http.StatusBadRequest, "Transaction amount mismatch. Please contact support.")
		return
	}

	// Determine user's name and anonymity status
	var userGoogleID, firstName, lastInitial sql.NullString
	anonymous := req.IsAnonymous

	session, _ := env.SessionStore.Get(r, "pool-party-session")
	if googleID, ok := session.Values["google_id"].(string); ok {
		// If user is logged in, always associate the transaction with their ID for internal tracking.
		userGoogleID.String = googleID
		userGoogleID.Valid = true

		// Only fetch their name if the donation is not anonymous.
		if !anonymous {
			var dbFirstName, lastName string
			userQuery := `SELECT first_name, last_name FROM users WHERE google_id = $1`
			err := env.DB.QueryRowContext(r.Context(), userQuery, googleID).Scan(&dbFirstName, &lastName)
			if err != nil {
				log.Printf("Could not find logged-in user %s for donation, will use PayPal name if available: %v", googleID, err)
			} else {
				if len(dbFirstName) > 0 {
					firstName.String = dbFirstName
					firstName.Valid = true
				}
				if len(lastName) > 0 {
					lastInitial.String = string(lastName[0])
					lastInitial.Valid = true
				}
			}
		}
	}

	// If not anonymous and name is not yet set (e.g. user not logged in, or DB lookup failed),
	// use the name from the PayPal response as a fallback.
	if !anonymous && !firstName.Valid && captureResponse != nil && captureResponse.Payer.Name.GivenName != "" {
		firstName.String = captureResponse.Payer.Name.GivenName
		firstName.Valid = true
		if captureResponse.Payer.Name.Surname != "" {
			lastInitial.String = string(captureResponse.Payer.Name.Surname[0])
			lastInitial.Valid = true
		}
	}

	var transactionID sql.NullString
	transactionID.String = captureResponse.PurchaseUnits[0].Payments.Captures[0].ID
	transactionID.Valid = true

	var description sql.NullString
	if req.Description != "" {
		description.String = req.Description
		description.Valid = true
	}

	ledgerData := LedgerEntryData{
		TransactionID:   transactionID,
		Amount:          capturedAmount,
		TransactionType: "deposit",
		UserGoogleID:    userGoogleID,
		FirstName:       firstName,
		LastInitial:     lastInitial,
		Anonymous:       anonymous,
		Description:     description,
		Allocations:     req.Allocations,
	}

	ledgerID, err := env.createLedgerEntries(r.Context(), ledgerData)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to record transaction")
		return
	}

	log.Printf("Successfully recorded transaction for PayPal order %s. Ledger ID: %d", req.OrderID, ledgerID)

	respondJSON(w, http.StatusOK, captureResponse)
}

// CreateExternalDonation handles the manual creation of a donation by a moderator.
func (env *APIEnv) CreateExternalDonation(w http.ResponseWriter, r *http.Request) {
	// Step 1: Get Moderator ID from session (middleware already confirmed they are a mod)
	session, _ := env.SessionStore.Get(r, "pool-party-session")
	moderatorGoogleID, ok := session.Values["google_id"].(string)
	if !ok {
		// This should not happen if middleware is working correctly
		respondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	// Step 2: Decode and Validate Request Body
	var req ExternalDonationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Description == "" {
		respondError(w, http.StatusBadRequest, "Description is required")
		return
	}
	if len(req.Allocations) == 0 {
		respondError(w, http.StatusBadRequest, "At least one allocation is required")
		return
	}

	var totalDonation float64
	for _, alloc := range req.Allocations {
		if alloc.Amount <= 0 {
			respondError(w, http.StatusBadRequest, "Donation amounts must be positive")
			return
		}
		totalDonation += alloc.Amount
	}

	var description sql.NullString
	description.String = req.Description
	description.Valid = true

	ledgerData := LedgerEntryData{
		Amount:          totalDonation,
		TransactionType: "deposit",
		UserGoogleID:    sql.NullString{String: moderatorGoogleID, Valid: true},
		// For external donations, FirstName, LastInitial are NULL, and Anonymous is false.
		// The frontend will display "External" based on transaction_type and NULL transaction_id.
		Anonymous:   false,
		Description: description,
		Allocations: req.Allocations,
	}

	ledgerID, err := env.createLedgerEntries(r.Context(), ledgerData)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to record external donation")
		return
	}

	log.Printf("Successfully recorded external donation by moderator %s. Ledger ID: %d", moderatorGoogleID, ledgerID)
	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"message":  "External donation recorded successfully",
		"ledgerID": ledgerID,
	})
}
