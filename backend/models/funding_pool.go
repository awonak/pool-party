package models

// FundingPool represents the data structure for a funding pool.
// It includes details about the pool and its funding status, designed to be
// easily converted to JSON for API responses.
type FundingPool struct {
	ID            int     `json:"id"`
	Name          string  `json:"name"`
	Description   *string `json:"description,omitempty"` // Use a pointer to handle potential NULL values from the DB.
	GoalAmount    float64 `json:"goal_amount"`
	CurrentAmount float64 `json:"current_amount"`
}

// CreateFundingPoolRequest defines the shape of the request body for creating a
// new funding pool.
type CreateFundingPoolRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	GoalAmount  float64 `json:"goal_amount"`
}
