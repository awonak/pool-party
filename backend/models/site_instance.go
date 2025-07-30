package models

// SiteInstance holds the dynamic configuration for the site's branding.
type SiteInstance struct {
	SiteTitle    string  `json:"site_title"`
	SiteHeadline *string `json:"site_headline,omitempty"`
}
