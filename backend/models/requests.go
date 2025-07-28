package models

// AllocationRequest represents a single allocation from the frontend.
type AllocationRequest struct {
	FundingPoolID int     `json:"funding_pool_id"`
	Amount        float64 `json:"amount"`
}

// WithdrawalRequest represents the data sent from the frontend to make a withdrawal.
type WithdrawalRequest struct {
	Allocations []AllocationRequest `json:"allocations"`
	Description string              `json:"description"`
}
