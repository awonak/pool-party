package handlers

import (
	"net/http"
)

// ModeratorRequired is a middleware that checks if the user is authenticated and is a moderator.
func (env *APIEnv) ModeratorRequired(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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

		// If authorized, call the next handler in the chain.
		next.ServeHTTP(w, r)
	}
}
