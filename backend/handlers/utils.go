package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"pool-party-api/models"
	"strconv"

	"github.com/gorilla/mux"
)

// RespondJSON sends a JSON response with the given status and data.
func RespondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("Error encoding JSON response: %v", err)
	}
}

// RespondError sends an error JSON response with the given status and message.
func RespondError(w http.ResponseWriter, status int, message string) {
	RespondJSON(w, status, map[string]string{"error": message})
}

// GetIDFromRequest extracts and converts the 'id' URL parameter to an int.
func GetIDFromRequest(r *http.Request) (int, error) {
	vars := mux.Vars(r)
	idStr, ok := vars["id"]
	if !ok {
		return 0, models.NewRequestError("ID is missing from parameters", http.StatusBadRequest)
	}

	id, err := strconv.Atoi(idStr)
	if err != nil {
		return 0, models.NewRequestError("Invalid ID format", http.StatusBadRequest)
	}
	return id, nil
}
