package handlers

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"

	"google.golang.org/api/idtoken"
)

type GoogleLoginRequest struct {
	Credential string `json:"credential"`
}

type UserResponse struct {
	GoogleID    string `json:"google_id"`
	Email       string `json:"email"`
	FirstName   string `json:"first_name"`
	LastName    string `json:"last_name"`
	IsModerator bool   `json:"is_moderator"`
}

// GoogleLogin verifies the ID token from Google Sign-In, creates or updates a user
// in the database, and establishes a session.
func (env *APIEnv) GoogleLogin(w http.ResponseWriter, r *http.Request) {
	var req GoogleLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	googleClientID := os.Getenv("GOOGLE_CLIENT_ID")
	if googleClientID == "" {
		respondError(w, http.StatusInternalServerError, "Google Client ID not configured")
		log.Println("GOOGLE_CLIENT_ID environment variable not set")
		return
	}

	// Validate the token
	payload, err := idtoken.Validate(context.Background(), req.Credential, googleClientID)
	if err != nil {
		respondError(w, http.StatusUnauthorized, "Invalid ID token")
		log.Printf("Token validation error: %v", err)
		return
	}

	// Upsert user in the database
	var user UserResponse
	query := `
		INSERT INTO users (google_id, email, first_name, last_name)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (google_id) DO UPDATE
		SET email = EXCLUDED.email, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name
		RETURNING google_id, email, first_name, last_name, is_moderator;
	`
	firstName, _ := payload.Claims["given_name"].(string)
	lastName, _ := payload.Claims["family_name"].(string)

	err = env.DB.QueryRowContext(r.Context(), query, payload.Subject, payload.Claims["email"], firstName, lastName).Scan(
		&user.GoogleID, &user.Email, &user.FirstName, &user.LastName, &user.IsModerator,
	)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to save user data")
		log.Printf("User upsert error: %v", err)
		return
	}

	// Create a session
	session, _ := env.SessionStore.Get(r, "pool-party-session")
	session.Values["google_id"] = user.GoogleID
	session.Values["authenticated"] = true
	if err := session.Save(r, w); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to save session")
		log.Printf("Session save error: %v", err)
		return
	}

	respondJSON(w, http.StatusOK, user)
}

// GetCurrentUser checks the session and returns the current user's data if authenticated.
func (env *APIEnv) GetCurrentUser(w http.ResponseWriter, r *http.Request) {
	session, _ := env.SessionStore.Get(r, "pool-party-session")
	googleID, ok := session.Values["google_id"].(string)
	if !ok || !session.Values["authenticated"].(bool) {
		respondError(w, http.StatusUnauthorized, "Not authenticated")
		return
	}

	var user UserResponse
	query := `SELECT google_id, email, first_name, last_name, is_moderator FROM users WHERE google_id = $1`
	err := env.DB.QueryRowContext(r.Context(), query, googleID).Scan(
		&user.GoogleID, &user.Email, &user.FirstName, &user.LastName, &user.IsModerator,
	)
	if err != nil {
		respondError(w, http.StatusNotFound, "User not found")
		return
	}

	respondJSON(w, http.StatusOK, user)
}

// Logout clears the user's session.
func (env *APIEnv) Logout(w http.ResponseWriter, r *http.Request) {
	session, _ := env.SessionStore.Get(r, "pool-party-session")
	session.Values["authenticated"] = false
	delete(session.Values, "google_id")
	session.Options.MaxAge = -1 // Deletes the cookie

	if err := session.Save(r, w); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to logout")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Successfully logged out"})
}
