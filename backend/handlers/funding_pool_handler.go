package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"pool-party-api/models"
	"strconv"

	"github.com/gorilla/mux"
)

// --- Utility Functions ---

// respondJSON sends a JSON response with the given status and data.
func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("Error encoding JSON response: %v", err)
	}
}

// respondError sends an error JSON response with the given status and message.
func respondError(w http.ResponseWriter, status int, message string) {
	respondJSON(w, status, map[string]string{"error": message})
}

// getIDFromRequest extracts and converts the 'id' URL parameter to an int.
func getIDFromRequest(r *http.Request) (int, error) {
	vars := mux.Vars(r)
	idStr, ok := vars["id"]
	if !ok {
		return 0, models.NewRequestError("ID is missing from parameters", http.StatusBadRequest)
	}

	id, err := strconv.Atoi(idStr)
	if err != nil {
		return 0, models.NewRequestError("Invalid ID format", http.StatusBadRequest)
	}
	return id, nil
}

// decodeAndValidateFundingPoolRequest decodes the request body and validates common fields.
func decodeAndValidateFundingPoolRequest(r *http.Request) (*models.CreateFundingPoolRequest, error) {
	var req models.CreateFundingPoolRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		return nil, models.NewRequestError("Invalid request body", http.StatusBadRequest)
	}

	if req.Name == "" {
		return nil, models.NewRequestError("Pool name is required", http.StatusBadRequest)
	}
	if req.GoalAmount <= 0 {
		return nil, models.NewRequestError("Goal amount must be a positive number", http.StatusBadRequest)
	}
	return &req, nil
}

// getFundingPoolQuery fetches funding pool(s) based on an optional ID.
// If id is 0, it fetches all pools. Otherwise, it fetches the pool with the given ID.
func (env *APIEnv) getFundingPoolQuery(r *http.Request, id int) ([]models.FundingPool, error) {
	query := `
        SELECT
            fp.id,
            fp.name,
            fp.description,
            fp.goal_amount,
            COALESCE(SUM(CASE WHEN l.transaction_type = 'deposit' THEN a.amount WHEN l.transaction_type = 'withdrawal' THEN -a.amount ELSE 0 END), 0) as current_amount
        FROM
            funding_pool fp
        LEFT JOIN
            allocation a ON fp.id = a.funding_pool_id
		LEFT JOIN
			ledger l ON a.ledger_id = l.id
        `
	var args []interface{}
	if id != 0 {
		query += ` WHERE fp.id = $1`
		args = append(args, id)
	}
	query += ` GROUP BY fp.id ORDER BY fp.id;`

	rows, err := env.DB.QueryContext(r.Context(), query, args...)
	if err != nil {
		log.Printf("Error querying funding pools: %v", err)
		return nil, models.NewInternalError("Error fetching funding pools")
	}
	defer rows.Close()

	pools := make([]models.FundingPool, 0)
	for rows.Next() {
		var p models.FundingPool
		var description sql.NullString
		if err := rows.Scan(&p.ID, &p.Name, &description, &p.GoalAmount, &p.CurrentAmount); err != nil {
			log.Printf("Error scanning funding pool row: %v", err)
			return nil, models.NewInternalError("Error scanning funding pool data")
		}
		if description.Valid {
			p.Description = &description.String
		}
		pools = append(pools, p)
	}

	return pools, nil
}

// --- Handler Functions ---

// GetFundingPools fetches all funding pools.
func (env *APIEnv) GetFundingPools(w http.ResponseWriter, r *http.Request) {
	pools, err := env.getFundingPoolQuery(r, 0) // Fetch all pools
	if err != nil {
		if reqErr, ok := err.(*models.RequestError); ok {
			respondError(w, reqErr.Status, reqErr.Message)
		} else {
			respondError(w, http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError))
		}
		return
	}
	respondJSON(w, http.StatusOK, pools)
}

// GetFundingPool fetches a single funding pool by its ID.
func (env *APIEnv) GetFundingPool(w http.ResponseWriter, r *http.Request) {
	id, err := getIDFromRequest(r)
	if err != nil {
		if reqErr, ok := err.(*models.RequestError); ok {
			respondError(w, reqErr.Status, reqErr.Message)
		} else { // Should not happen for getIDFromRequest
			respondError(w, http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError))
		}
		return
	}

	pools, err := env.getFundingPoolQuery(r, id)
	if err != nil {
		if reqErr, ok := err.(*models.RequestError); ok {
			respondError(w, reqErr.Status, reqErr.Message)
		} else {
			respondError(w, http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError))
		}
		return
	}

	if len(pools) == 0 {
		respondError(w, http.StatusNotFound, "Funding pool not found")
		return
	}
	respondJSON(w, http.StatusOK, pools[0])
}

// CreateFundingPool handles the creation of a new funding pool.
func (env *APIEnv) CreateFundingPool(w http.ResponseWriter, r *http.Request) {
	// Authorization check
	session, _ := env.SessionStore.Get(r, "pool-party-session")
	googleID, ok := session.Values["google_id"].(string)
	if !ok || !session.Values["authenticated"].(bool) {
		respondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}
	var isModerator bool
	err := env.DB.QueryRowContext(r.Context(), "SELECT is_moderator FROM users WHERE google_id = $1", googleID).Scan(&isModerator)
	if err != nil || !isModerator {
		respondError(w, http.StatusForbidden, "User is not a moderator")
		return
	}

	req, err := decodeAndValidateFundingPoolRequest(r)
	if err != nil {
		if reqErr, ok := err.(*models.RequestError); ok {
			respondError(w, reqErr.Status, reqErr.Message)
		}
		return
	}

	query := `
        INSERT INTO funding_pool (name, description, goal_amount)
        VALUES ($1, $2, $3)
        RETURNING id`

	var newID int
	err = env.DB.QueryRowContext(r.Context(), query, req.Name, req.Description, req.GoalAmount).Scan(&newID)
	if err != nil {
		// Consider adding more specific error handling for unique constraint violations etc.
		log.Printf("Error inserting new funding pool: %v", err)
		respondError(w, http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError))
		return
	}

	newPool := models.FundingPool{
		ID:            newID,
		Name:          req.Name,
		Description:   req.Description,
		GoalAmount:    req.GoalAmount,
		CurrentAmount: 0,
	}

	respondJSON(w, http.StatusCreated, newPool)
}

// UpdateFundingPool handles updates to an existing funding pool.
func (env *APIEnv) UpdateFundingPool(w http.ResponseWriter, r *http.Request) {
	// Authorization check
	session, _ := env.SessionStore.Get(r, "pool-party-session")
	googleID, ok := session.Values["google_id"].(string)
	if !ok || !session.Values["authenticated"].(bool) {
		respondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}
	var isModerator bool
	err := env.DB.QueryRowContext(r.Context(), "SELECT is_moderator FROM users WHERE google_id = $1", googleID).Scan(&isModerator)
	if err != nil || !isModerator {
		respondError(w, http.StatusForbidden, "User is not a moderator")
		return
	}

	id, err := getIDFromRequest(r)
	if err != nil {
		if reqErr, ok := err.(*models.RequestError); ok {
			respondError(w, reqErr.Status, reqErr.Message)
		} else {
			respondError(w, http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError))
		}
		return
	}

	req, err := decodeAndValidateFundingPoolRequest(r)
	if err != nil {
		if reqErr, ok := err.(*models.RequestError); ok {
			respondError(w, reqErr.Status, reqErr.Message)
		}
		return
	}

	updateQuery := `UPDATE funding_pool SET name = $1, description = $2, goal_amount = $3 WHERE id = $4`
	result, err := env.DB.ExecContext(r.Context(), updateQuery, req.Name, req.Description, req.GoalAmount, id)
	if err != nil {
		log.Printf("Error updating funding pool with ID %d: %v", id, err)
		respondError(w, http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError))
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		respondError(w, http.StatusNotFound, "Funding pool not found")
		return
	}

	// To return the full updated object, fetch it after update.
	// You could also construct it from the request body if you're certain it reflects the DB state.
	updatedPools, err := env.getFundingPoolQuery(r, id)
	if err != nil {
		if reqErr, ok := err.(*models.RequestError); ok {
			respondError(w, reqErr.Status, reqErr.Message)
		} else {
			respondError(w, http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError))
		}
		return
	}
	if len(updatedPools) == 0 { // Should not happen if rowsAffected > 0
		respondError(w, http.StatusNotFound, "Updated funding pool not found after fetch")
		return
	}
	respondJSON(w, http.StatusOK, updatedPools[0])
}

// DeleteFundingPool handles the deletion of a funding pool.
func (env *APIEnv) DeleteFundingPool(w http.ResponseWriter, r *http.Request) {
	// Authorization check
	session, _ := env.SessionStore.Get(r, "pool-party-session")
	googleID, ok := session.Values["google_id"].(string)
	if !ok || !session.Values["authenticated"].(bool) {
		respondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}
	var isModerator bool
	err := env.DB.QueryRowContext(r.Context(), "SELECT is_moderator FROM users WHERE google_id = $1", googleID).Scan(&isModerator)
	if err != nil || !isModerator {
		respondError(w, http.StatusForbidden, "User is not a moderator")
		return
	}

	id, err := getIDFromRequest(r)
	if err != nil {
		if reqErr, ok := err.(*models.RequestError); ok {
			respondError(w, reqErr.Status, reqErr.Message)
		} else {
			respondError(w, http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError))
		}
		return
	}

	tx, err := env.DB.BeginTx(r.Context(), nil)
	if err != nil {
		log.Printf("Error starting transaction: %v", err)
		respondError(w, http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError))
		return
	}
	defer tx.Rollback() // Will be rolled back if Commit() is not called

	var allocationExists int
	checkQuery := `SELECT 1 FROM allocation WHERE funding_pool_id = $1 LIMIT 1`
	err = tx.QueryRowContext(r.Context(), checkQuery, id).Scan(&allocationExists)

	if err == nil { // Row found, allocations exist
		respondError(w, http.StatusBadRequest, "Cannot delete funding pool with existing donations")
		return
	}
	if err != sql.ErrNoRows { // Unexpected DB error
		log.Printf("Error checking for allocations for pool ID %d: %v", id, err)
		respondError(w, http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError))
		return
	}

	deleteQuery := `DELETE FROM funding_pool WHERE id = $1`
	result, err := tx.ExecContext(r.Context(), deleteQuery, id)
	if err != nil {
		log.Printf("Error deleting funding pool with ID %d: %v", id, err)
		respondError(w, http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError))
		return
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		respondError(w, http.StatusNotFound, "Funding pool not found")
		return
	}

	if err := tx.Commit(); err != nil {
		log.Printf("Error committing transaction for deleting pool ID %d: %v", id, err)
		respondError(w, http.StatusInternalServerError, http.StatusText(http.StatusInternalServerError))
		return
	}

	w.WriteHeader(http.StatusNoContent) // No content to return for successful deletion
}
