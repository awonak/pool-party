package handlers

import (
	"database/sql"
	"log"
	"net/http"
	"pool-party-api/models"
)

// GetSiteInstance fetches the site's configuration details.
func (env *APIEnv) GetSiteInstance(w http.ResponseWriter, r *http.Request) {
	var instance models.SiteInstance
	var headline sql.NullString

	query := `SELECT site_title, site_headline FROM site_instance WHERE id = 1`
	err := env.DB.QueryRowContext(r.Context(), query).Scan(&instance.SiteTitle, &headline)

	if err != nil {
		if err == sql.ErrNoRows {
			log.Println("Critical: site_instance table not seeded with id=1")
			respondError(w, http.StatusInternalServerError, "Site configuration not found.")
		} else {
			log.Printf("Error querying site_instance: %v", err)
			respondError(w, http.StatusInternalServerError, "Error fetching site configuration.")
		}
		return
	}

	if headline.Valid {
		instance.SiteHeadline = &headline.String
	}

	respondJSON(w, http.StatusOK, instance)
}
