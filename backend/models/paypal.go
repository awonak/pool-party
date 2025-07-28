package models

// AccessTokenResponse is the response for a PayPal OAuth2 token request.
type AccessTokenResponse struct {
	Scope       string `json:"scope"`
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	AppID       string `json:"app_id"`
	ExpiresIn   int    `json:"expires_in"`
	Nonce       string `json:"nonce"`
}

// Payer represents the person paying for the order in a PayPal response.
type Payer struct {
	Name struct {
		GivenName string `json:"given_name"`
		Surname   string `json:"surname"`
	} `json:"name"`
	EmailAddress string `json:"email_address"`
}

// CaptureAmount is the amount captured in a transaction.
type CaptureAmount struct {
	CurrencyCode string `json:"currency_code"`
	Value        string `json:"value"`
}

// Capture is a payment capture in a PayPal order.
type Capture struct {
	ID     string        `json:"id"`
	Status string        `json:"status"`
	Amount CaptureAmount `json:"amount"`
}

// Payments holds the captures for a purchase unit.
type Payments struct {
	Captures []Capture `json:"captures"`
}

// PurchaseUnit is part of a PayPal order.
type PurchaseUnit struct {
	Payments Payments `json:"payments"`
}

// OrderCaptureResponse is the response from PayPal after capturing an order.
type OrderCaptureResponse struct {
	ID            string         `json:"id"`
	Status        string         `json:"status"`
	Payer         Payer          `json:"payer"`
	PurchaseUnits []PurchaseUnit `json:"purchase_units"`
}
