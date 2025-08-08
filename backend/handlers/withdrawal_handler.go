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
	// Step 1: Authentication and Authorization
	session, _ := env.SessionStore.Get(r, "pool-party-session")
	googleID, ok := session.Values["google_id"].(string)
	if !ok || !session.Values["authenticated"].(bool) {
		RespondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	var isModerator bool
	err := env.DB.QueryRowContext(r.Context(), "SELECT is_moderator FROM users WHERE google_id = $1", googleID).Scan(&isModerator)
	if err != nil || !isModerator {
		RespondError(w, http.StatusForbidden, "User is not a moderator")
		return
	}

	// Step 2: Decode and Validate Request Body
	var req models.WithdrawalRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		RespondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Description == "" {
		RespondError(w, http.StatusBadRequest, "Description is required")
		return
	}
	if len(req.Allocations) == 0 {
		RespondError(w, http.StatusBadRequest, "At least one allocation is required")
		return
	}

	var totalWithdrawal float64
	for _, alloc := range req.Allocations {
		if alloc.Amount <= 0 {
			RespondError(w, http.StatusBadRequest, "Withdrawal amounts must be positive")
			return
		}
		totalWithdrawal += alloc.Amount
	}

	// Step 3: Database Transaction
	tx, err := env.DB.BeginTx(r.Context(), nil)
	if err != nil {
		log.Printf("Failed to start database transaction: %v", err)
		RespondError(w, http.StatusInternalServerError, "Database error")
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
			RespondError(w, http.StatusInternalServerError, "Could not verify pool funds")
			return
		}
		if alloc.Amount > poolBalance {
			msg := fmt.Sprintf("Withdrawal amount for a pool exceeds its balance of $%.2f", poolBalance)
			RespondError(w, http.StatusBadRequest, msg)
			return
		}
	}

	// Step 5: Insert Ledger Entry
	var userFirstName, userLastName sql.NullString
	userQuery := `SELECT first_name, last_name FROM users WHERE google_id = $1`
	tx.QueryRowContext(r.Context(), userQuery, googleID).Scan(&userFirstName, &userLastName)

	var lastNameInitial sql.NullString
	if userLastName.Valid && len(userLastName.String) > 0 {
		lastNameInitial.String = string(userLastName.String[0])
		lastNameInitial.Valid = true
	}

	var ledgerID int
	ledgerQuery := `
		INSERT INTO ledger (amount, transaction_type, user_google_id, first_name, last_initial, description, anonymous)
		VALUES ($1, 'withdrawal', $2, $3, $4, $5, false)
		RETURNING id`
	err = tx.QueryRowContext(r.Context(), ledgerQuery, totalWithdrawal, googleID, userFirstName, lastNameInitial, req.Description).Scan(&ledgerID)
	if err != nil {
		log.Printf("Failed to insert withdrawal into ledger: %v", err)
		RespondError(w, http.StatusInternalServerError, "Failed to record withdrawal")
		return
	}

	// Step 6: Insert Allocations
	for _, alloc := range req.Allocations {
		_, err := tx.ExecContext(r.Context(), "INSERT INTO allocation (ledger_id, funding_pool_id, amount) VALUES ($1, $2, $3)", ledgerID, alloc.FundingPoolID, alloc.Amount)
		if err != nil {
			log.Printf("Failed to insert withdrawal allocation for pool %d: %v", alloc.FundingPoolID, err)
			RespondError(w, http.StatusInternalServerError, "Failed to record withdrawal allocation")
			return
		}
	}

	// Step 7: Commit Transaction
	if err := tx.Commit(); err != nil {
		log.Printf("Failed to commit withdrawal transaction: %v", err)
		RespondError(w, http.StatusInternalServerError, "Failed to finalize withdrawal")
		return
	}

	log.Printf("Successfully recorded withdrawal by user %s. Ledger ID: %d", googleID, ledgerID)
	RespondJSON(w, http.StatusCreated, map[string]string{"message": "Withdrawal recorded successfully"})
}
