package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"pool-party-api/models"
)

// MakeWithdrawal handles recording a withdrawal transaction in the ledger.
// This is a moderator-only action.
func (env *APIEnv) MakeWithdrawal(w http.ResponseWriter, r *http.Request) {
	// Step 1: Get Moderator ID from session (middleware already confirmed they are a mod)
	session, _ := env.SessionStore.Get(r, "pool-party-session")
	googleID, ok := session.Values["google_id"].(string)
	if !ok {
		// This should not happen if middleware is working correctly
		respondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	// Step 2: Decode and Validate Request Body
	var req models.WithdrawalRequest
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

	var totalWithdrawal float64
	for _, alloc := range req.Allocations {
		if alloc.Amount <= 0 {
			respondError(w, http.StatusBadRequest, "Withdrawal amounts must be positive")
			return
		}
		totalWithdrawal += alloc.Amount
	}

	// Step 3: Database Transaction
	tx, err := env.DB.BeginTx(r.Context(), nil)
	if err != nil {
		log.Printf("Failed to start database transaction: %v", err)
		respondError(w, http.StatusInternalServerError, "Database error")
		return
	}
	defer tx.Rollback()

	// Step 4: Validate that withdrawal doesn't exceed each pool's balance
	for _, alloc := range req.Allocations {
		var poolBalance float64
		poolQuery := `
            SELECT COALESCE(SUM(CASE WHEN l.transaction_type = 'deposit' THEN a.amount ELSE -a.amount END), 0)
            FROM allocation a
            JOIN ledger l ON a.ledger_id = l.id
            WHERE a.funding_pool_id = $1
        `
		err := tx.QueryRowContext(r.Context(), poolQuery, alloc.FundingPoolID).Scan(&poolBalance)
		if err != nil {
			log.Printf("Failed to get balance for pool %d: %v", alloc.FundingPoolID, err)
			respondError(w, http.StatusInternalServerError, "Could not verify pool funds")
			return
		}
		if alloc.Amount > poolBalance {
			msg := fmt.Sprintf("Withdrawal amount for a pool exceeds its balance of $%.2f", poolBalance)
			respondError(w, http.StatusBadRequest, msg)
			return
		}
	}

	// Step 5: Get moderator user info
	var userFirstName, userLastName sql.NullString
	userQuery := `SELECT first_name, last_name FROM users WHERE google_id = $1`
	err = tx.QueryRowContext(r.Context(), userQuery, googleID).Scan(&userFirstName, &userLastName)
	if err != nil {
		// This is unlikely if middleware passed, but handle it.
		log.Printf("Failed to get moderator info for google_id %s: %v", googleID, err)
		respondError(w, http.StatusInternalServerError, "Could not retrieve moderator information")
		return
	}

	var lastNameInitial sql.NullString
	if userLastName.Valid && len(userLastName.String) > 0 {
		lastNameInitial.String = string(userLastName.String[0])
		lastNameInitial.Valid = true
	}

	// Step 6: Prepare data and create ledger entries
	var description sql.NullString
	description.String = req.Description
	description.Valid = true

	ledgerData := LedgerEntryData{
		Amount:          totalWithdrawal,
		TransactionType: "withdrawal",
		UserGoogleID:    sql.NullString{String: googleID, Valid: true},
		FirstName:       userFirstName,
		LastInitial:     lastNameInitial,
		Anonymous:       false,
		Description:     description,
		Allocations:     req.Allocations,
	}

	ledgerID, err := env.CreateLedgerEntriesInTx(r.Context(), tx, ledgerData)
	if err != nil {
		log.Printf("Failed to insert withdrawal into ledger: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to record withdrawal")
		return
	}

	// Step 7: Commit Transaction
	if err := tx.Commit(); err != nil {
		log.Printf("Failed to commit withdrawal transaction: %v", err)
		respondError(w, http.StatusInternalServerError, "Failed to finalize withdrawal")
		return
	}

	log.Printf("Successfully recorded withdrawal by user %s. Ledger ID: %d", googleID, ledgerID)
	respondJSON(w, http.StatusCreated, map[string]string{"message": "Withdrawal recorded successfully"})
}
