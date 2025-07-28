package main

import (
	"database/sql"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"pool-party-api/database"
	"pool-party-api/handlers"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/gorilla/sessions"
)

// spaHandler implements the http.Handler interface, so we can use it
// to respond to HTTP requests. The path to the static directory and
// the index file within that static directory are used to
// serve the SPA in the given static directory.
type spaHandler struct {
	staticPath string
	indexPath  string
}

// ServeHTTP inspects the URL path to locate a file within the static dir
// on the SPA handler. If a file is found, it will be served. If not, the
// file located at the index path on the SPA handler will be served. This
// is suitable behavior for serving an SPA (single page application).
func (h spaHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	// get the absolute path to prevent directory traversal
	path, err := filepath.Abs(r.URL.Path)
	if err != nil {
		// if we failed to get the absolute path respond with a 400 bad request
		// and stop
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// prepend the path with the path to the static directory
	path = filepath.Join(h.staticPath, path)

	// check whether a file exists at the given path
	_, err = os.Stat(path)
	if os.IsNotExist(err) {
		// file does not exist, serve index.html
		http.ServeFile(w, r, filepath.Join(h.staticPath, h.indexPath))
		return
	} else if err != nil {
		// if we got an error (that wasn't that the file doesn't exist) stating the
		// file, return a 500 internal server error and stop
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// otherwise, use http.FileServer to serve the static file
	http.FileServer(http.Dir(h.staticPath)).ServeHTTP(w, r)
}

func main() {
	// Initialize the database connection.
	db, err := database.InitDB()
	if err != nil {
		log.Fatalf("could not initialize database: %v", err)
	}
	defer func(db *sql.DB) {
		err := db.Close()
		if err != nil {
			log.Printf("failed to close database: %v", err)
		}
	}(db)

	// Initialize session store.
	// The key should be stored securely in production (e.g., Google Secret Manager).
	sessionKey := os.Getenv("SESSION_SECRET")
	if sessionKey == "" {
		log.Fatal("SESSION_SECRET environment variable not set.")
	}
	store := sessions.NewCookieStore([]byte(sessionKey))

	// Create an environment to hold the database connection.
	env := &handlers.APIEnv{DB: db, SessionStore: store}

	// Create a new router
	router := mux.NewRouter()

	// Define the FundingPool routes
	apiRouter := router.PathPrefix("/api").Subrouter()
	apiRouter.HandleFunc("/funding-pools", env.GetFundingPools).Methods("GET")
	apiRouter.HandleFunc("/funding-pools/{id}", env.GetFundingPool).Methods("GET")
	apiRouter.HandleFunc("/funding-pools", env.CreateFundingPool).Methods("POST")
	apiRouter.HandleFunc("/funding-pools/{id}", env.UpdateFundingPool).Methods("PUT")
	apiRouter.HandleFunc("/funding-pools/{id}", env.DeleteFundingPool).Methods("DELETE")

	// Define the Auth routes
	apiRouter.HandleFunc("/auth/google/callback", env.GoogleLogin).Methods("POST")
	apiRouter.HandleFunc("/auth/me", env.GetCurrentUser).Methods("GET")
	apiRouter.HandleFunc("/auth/logout", env.Logout).Methods("POST")

	// Define the Ledger routes
	apiRouter.HandleFunc("/ledger", env.GetLedgerEntries).Methods("GET")

	// Define the Donation routes
	apiRouter.HandleFunc("/donations/capture", env.CaptureDonation).Methods("POST")

	// Define the Withdrawal routes
	apiRouter.HandleFunc("/withdrawals", env.MakeWithdrawal).Methods("POST")

	spa := spaHandler{staticPath: "../frontend/build", indexPath: "index.html"}
	router.PathPrefix("/").Handler(spa)

	// Start the server
	// Cloud Run provides the PORT environment variable.
	portStr := os.Getenv("PORT")
	if portStr == "" {
		portStr = "8000" // Default port if not specified
	}
	port, err := strconv.Atoi(portStr)
	if err != nil {
		log.Fatalf("Invalid port: %v", err)
	}
	fmt.Printf("Server listening on port %d...\n", port)
	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", port), router))
}
