package paypal

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"pool-party-api/models"
	"strings"
	"time"
)

// Client manages communication with the PayPal API.
type Client struct {
	ClientID     string
	ClientSecret string
	BaseURL      string
	HTTPClient   *http.Client
}

// NewClient creates a new PayPal API client.
func NewClient() (*Client, error) {
	clientID := os.Getenv("PAYPAL_CLIENT_ID")
	clientSecret := os.Getenv("PAYPAL_CLIENT_SECRET")
	baseURL := os.Getenv("PAYPAL_API_BASE")

	if clientID == "" || clientSecret == "" || baseURL == "" {
		return nil, fmt.Errorf("PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, and PAYPAL_API_BASE must be set")
	}

	return &Client{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		BaseURL:      baseURL,
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}, nil
}

// GetAccessToken retrieves an OAuth2 access token from PayPal.
func (c *Client) GetAccessToken(ctx context.Context) (string, error) {
	reqURL := fmt.Sprintf("%s/v1/oauth2/token", c.BaseURL)
	data := url.Values{}
	data.Set("grant_type", "client_credentials")

	req, err := http.NewRequestWithContext(ctx, "POST", reqURL, strings.NewReader(data.Encode()))
	if err != nil {
		return "", fmt.Errorf("failed to create access token request: %w", err)
	}

	req.SetBasicAuth(c.ClientID, c.ClientSecret)
	req.Header.Add("Content-Type", "application/x-www-form-urlencoded")

	res, err := c.HTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to get access token: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(res.Body)
		return "", fmt.Errorf("failed to get access token, status: %s, body: %s", res.Status, string(bodyBytes))
	}

	var tokenResponse models.AccessTokenResponse
	if err := json.NewDecoder(res.Body).Decode(&tokenResponse); err != nil {
		return "", fmt.Errorf("failed to decode access token response: %w", err)
	}

	return tokenResponse.AccessToken, nil
}

// CaptureOrder captures a payment for a PayPal order.
func (c *Client) CaptureOrder(ctx context.Context, orderID string, accessToken string) (*models.OrderCaptureResponse, error) {
	reqURL := fmt.Sprintf("%s/v2/checkout/orders/%s/capture", c.BaseURL, orderID)

	req, err := http.NewRequestWithContext(ctx, "POST", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create capture order request: %w", err)
	}

	req.Header.Add("Content-Type", "application/json")
	req.Header.Add("Authorization", "Bearer "+accessToken)

	res, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to capture order: %w", err)
	}
	defer res.Body.Close()

	bodyBytes, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read capture response body: %w", err)
	}

	if res.StatusCode != http.StatusCreated {
		log.Printf("PayPal capture failed for Order ID %s. Status: %s, Body: %s", orderID, res.Status, string(bodyBytes))
		return nil, fmt.Errorf("failed to capture order, status: %s", res.Status)
	}

	var captureResponse models.OrderCaptureResponse
	if err := json.Unmarshal(bodyBytes, &captureResponse); err != nil {
		return nil, fmt.Errorf("failed to decode capture order response: %w", err)
	}

	return &captureResponse, nil
}
