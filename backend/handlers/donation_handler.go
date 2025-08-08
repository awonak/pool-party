package handlers

import (
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

// CaptureDonation verifies a PayPal order, captures the payment, and records the transaction.
func (env *APIEnv) CaptureDonation(w http.ResponseWriter, r *http.Request) {
	var req CaptureDonationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.OrderID == "" {
		RespondError(w, http.StatusBadRequest, "Missing orderID")
		return
	}

	// Create a new PayPal client
	ppClient, err := paypal.NewClient()
	if err != nil {
		log.Printf("Error creating PayPal client: %v", err)
		RespondError(w, http.StatusInternalServerError, "PayPal client configuration error")
		return
	}

	// Get an access token
	accessToken, err := ppClient.GetAccessToken(r.Context())
	if err != nil {
		log.Printf("Error getting PayPal access token: %v", err)
		RespondError(w, http.StatusInternalServerError, "Failed to authenticate with PayPal")
		return
	}

	// Capture the order
	captureResponse, err := ppClient.CaptureOrder(r.Context(), req.OrderID, accessToken)
	if err != nil {
		log.Printf("Error capturing PayPal order %s: %v", req.OrderID, err)
		RespondError(w, http.StatusInternalServerError, "Failed to capture PayPal payment")
		return
	}

	// Validate the capture was successful
	if captureResponse.Status != "COMPLETED" {
		RespondError(w, http.StatusInternalServerError, "PayPal payment not completed")
		log.Printf("PayPal order %s status is %s, not COMPLETED", req.OrderID, captureResponse.Status)
		return
	}

	// Extract captured amount from PayPal response
	if len(captureResponse.PurchaseUnits) == 0 || len(captureResponse.PurchaseUnits[0].Payments.Captures) == 0 {
		RespondError(w, http.StatusInternalServerError, "Invalid PayPal capture response")
		log.Printf("PayPal order %s has no purchase units or captures", req.OrderID)
		return
	}

	capturedAmountStr := captureResponse.PurchaseUnits[0].Payments.Captures[0].Amount.Value
	capturedAmount, err := strconv.ParseFloat(capturedAmountStr, 64)
	if err != nil {
		RespondError(w, http.StatusInternalServerError, "Invalid amount in PayPal response")
		log.Printf("Could not parse captured amount '%s' for order %s: %v", capturedAmountStr, req.OrderID, err)
		return
	}

	// Calculate total from frontend allocations
	var totalAllocation float64
	for _, alloc := range req.Allocations {
		if alloc.Amount < 0 {
			RespondError(w, http.StatusBadRequest, "Donation amounts cannot be negative.")
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
		RespondError(w, http.StatusBadRequest, "Transaction amount mismatch. Please contact support.")
		return
	}

	// --- Database Transaction Starts Here ---
	tx, err := env.DB.BeginTx(r.Context(), nil)
	if err != nil {
		log.Printf("Failed to start database transaction: %v", err)
		RespondError(w, http.StatusInternalServerError, "Database error")
		return
	}
	defer tx.Rollback() // Rollback on any error

	// Determine user's name and anonymity status
	var userGoogleID, firstName, lastInitial sql.NullString
	anonymous := req.IsAnonymous

	session, _ := env.SessionStore.Get(r, "pool-party-session")
	if googleID, ok := session.Values["google_id"].(string); ok && session.Values["authenticated"].(bool) {
		// If user is logged in, always associate the transaction with their ID for internal tracking.
		userGoogleID.String = googleID
		userGoogleID.Valid = true

		// Only fetch their name if the donation is not anonymous.
		if !anonymous {
			var dbFirstName, lastName string
			userQuery := `SELECT first_name, last_name FROM users WHERE google_id = $1`
			err := tx.QueryRowContext(r.Context(), userQuery, googleID).Scan(&dbFirstName, &lastName)
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

	// Insert the main ledger entry
	var ledgerID int
	paypalTransactionID := captureResponse.PurchaseUnits[0].Payments.Captures[0].ID
	var description sql.NullString
	if req.Description != "" {
		description.String = req.Description
		description.Valid = true
	}
	ledgerQuery := `
		INSERT INTO ledger (transaction_id, amount, transaction_type, user_google_id, first_name, last_initial, anonymous, description)
		VALUES ($1, $2, 'deposit', $3, $4, $5, $6, $7)
		RETURNING id`
	err = tx.QueryRowContext(r.Context(), ledgerQuery, paypalTransactionID, capturedAmount, userGoogleID, firstName, lastInitial, anonymous, description).Scan(&ledgerID)
	if err != nil {
		log.Printf("Failed to insert into ledger: %v", err)
		RespondError(w, http.StatusInternalServerError, "Failed to record transaction")
		return
	}

	// Insert all the individual allocations
	for _, alloc := range req.Allocations {
		if alloc.Amount > 0 { // Only insert allocations with a positive amount
			_, err := tx.ExecContext(r.Context(), "INSERT INTO allocation (ledger_id, funding_pool_id, amount) VALUES ($1, $2, $3)", ledgerID, alloc.FundingPoolID, alloc.Amount)
			if err != nil {
				log.Printf("Failed to insert allocation for pool %d: %v", alloc.FundingPoolID, err)
				RespondError(w, http.StatusInternalServerError, "Failed to record transaction allocation")
				return
			}
		}
	}

	// Commit the transaction if all inserts were successful
	if err := tx.Commit(); err != nil {
		log.Printf("Failed to commit transaction: %v", err)
		RespondError(w, http.StatusInternalServerError, "Failed to finalize transaction")
		return
	}

	log.Printf("Successfully recorded transaction for PayPal order %s. Ledger ID: %d", req.OrderID, ledgerID)

	RespondJSON(w, http.StatusOK, captureResponse)
}
