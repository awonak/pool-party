package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"pool-party-api/models"
)

// GetLedgerEntries fetches all ledger entries and their associated allocations.
// It performs two queries to efficiently gather all data and then stitches it
// together in the application to avoid N+1 query issues.
func (env *APIEnv) GetLedgerEntries(w http.ResponseWriter, r *http.Request) {
	// Query all ledger entries, ordered by the most recent first.
	ledgerQuery := `
		SELECT
			id, transaction_id, amount, timestamp, transaction_type,
			user_google_id, first_name, last_initial, description, anonymous
		FROM ledger
		ORDER BY timestamp DESC;`

	rows, err := env.DB.QueryContext(r.Context(), ledgerQuery)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Error fetching ledger entries")
		log.Printf("Error querying ledger: %v", err)
		return
	}
	defer rows.Close()

	// Use a map for efficient lookup of ledger entries by their ID.
	ledgerEntriesMap := make(map[int]*models.LedgerEntry)
	// Use a slice to maintain the order of entries.
	var ledgerEntries []*models.LedgerEntry

	for rows.Next() {
		var entry models.LedgerEntry
		var transactionID, userGoogleID, firstName, lastInitial, description sql.NullString

		err := rows.Scan(
			&entry.ID, &transactionID, &entry.Amount, &entry.Timestamp, &entry.TransactionType,
			&userGoogleID, &firstName, &lastInitial, &description, &entry.Anonymous,
		)
		if err != nil {
			respondError(w, http.StatusInternalServerError, "Error scanning ledger entry")
			log.Printf("Error scanning ledger row: %v", err)
			return
		}

		// Assign values from nullable database fields to the struct pointers.
		if transactionID.Valid {
			entry.TransactionID = &transactionID.String
		}
		if userGoogleID.Valid {
			entry.UserGoogleID = &userGoogleID.String
		}
		if firstName.Valid {
			entry.FirstName = &firstName.String
		}
		if lastInitial.Valid {
			entry.LastInitial = &lastInitial.String
		}
		if description.Valid {
			entry.Description = &description.String
		}

		entry.Allocations = []models.Allocation{} // Initialize to ensure an empty array, not null, in JSON.
		ledgerEntries = append(ledgerEntries, &entry)
		ledgerEntriesMap[entry.ID] = &entry
	}
	if err = rows.Err(); err != nil {
		respondError(w, http.StatusInternalServerError, "Error iterating ledger entries")
		log.Printf("Error after iterating ledger rows: %v", err)
		return
	}

	// Now, query all allocations in a second, separate query.
	allocationQuery := `SELECT id, ledger_id, funding_pool_id, amount FROM allocation;`
	allocRows, err := env.DB.QueryContext(r.Context(), allocationQuery)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Error fetching allocations")
		log.Printf("Error querying allocations: %v", err)
		return
	}
	defer allocRows.Close()

	// Stitch the allocations into their parent ledger entries.
	for allocRows.Next() {
		var alloc models.Allocation
		if err := allocRows.Scan(&alloc.ID, &alloc.LedgerID, &alloc.FundingPoolID, &alloc.Amount); err != nil {
			respondError(w, http.StatusInternalServerError, "Error scanning allocation")
			log.Printf("Error scanning allocation row: %v", err)
			return
		}

		if entry, ok := ledgerEntriesMap[alloc.LedgerID]; ok {
			entry.Allocations = append(entry.Allocations, alloc)
		}
	}
	if err = allocRows.Err(); err != nil {
		respondError(w, http.StatusInternalServerError, "Error iterating allocations")
		log.Printf("Error after iterating allocation rows: %v", err)
		return
	}

	// Query for the total donations and withdrawals in a single query for efficiency.
	var totalDonations float64
	var totalWithdrawals float64
	totalsQuery := `
		SELECT
			COALESCE(SUM(CASE WHEN transaction_type = 'deposit' THEN amount ELSE 0 END), 0) as total_donations,
			COALESCE(SUM(CASE WHEN transaction_type = 'withdrawal' THEN amount ELSE 0 END), 0) as total_withdrawals
		FROM ledger;
	`
	err = env.DB.QueryRowContext(r.Context(), totalsQuery).Scan(&totalDonations, &totalWithdrawals)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Error fetching ledger totals")
		log.Printf("Error querying ledger totals: %v", err)
		return
	}

	// Create a response struct to hold both transactions and the total.
	response := struct {
		Transactions     []*models.LedgerEntry `json:"transactions"`
		TotalDonations   float64               `json:"total_donations"`
		TotalWithdrawals float64               `json:"total_withdrawals"`
	}{
		Transactions:     ledgerEntries,
		TotalDonations:   totalDonations,
		TotalWithdrawals: totalWithdrawals,
	}

	respondJSON(w, http.StatusOK, response)
}
