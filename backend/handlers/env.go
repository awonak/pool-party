package handlers

import (
	"database/sql"

	"github.com/gorilla/sessions"
)

// APIEnv holds application-wide dependencies, such as the database connection
// pool and session store, making them available to all handlers.
type APIEnv struct {
	DB           *sql.DB
	SessionStore sessions.Store
}
