package models

import "time"

// Allocation represents how a single ledger entry's amount is distributed
// across one or more funding pools.
type Allocation struct {
	ID            int     `json:"id"`
	LedgerID      int     `json:"ledger_id"`
	FundingPoolID int     `json:"funding_pool_id"`
	Amount        float64 `json:"amount"`
}

// LedgerEntry represents a single transaction, either a deposit or a withdrawal.
// It can contain multiple allocations to different funding pools.
type LedgerEntry struct {
	ID              int          `json:"id"`
	TransactionID   *string      `json:"transaction_id,omitempty"`
	Amount          float64      `json:"amount"`
	Timestamp       time.Time    `json:"timestamp"`
	TransactionType string       `json:"transaction_type"`
	UserGoogleID    *string      `json:"user_google_id,omitempty"`
	FirstName       *string      `json:"first_name,omitempty"`
	LastInitial     *string      `json:"last_initial,omitempty"`
	Description     *string      `json:"description,omitempty"`
	Anonymous       bool         `json:"anonymous"`
	Allocations     []Allocation `json:"allocations"`
}
