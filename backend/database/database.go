package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"net"
	"os"

	"cloud.google.com/go/cloudsqlconn"
	"github.com/jackc/pgx/v4"
	"github.com/jackc/pgx/v4/stdlib"
)

// InitDB initializes and returns a database connection pool for Cloud SQL.
func InitDB() (*sql.DB, error) {
	// A helper function to safely get environment variables.
	mustGetenv := func(k string) string {
		v := os.Getenv(k)
		if v == "" {
			log.Fatalf("Fatal Error: %s environment variable not set.", k)
		}
		return v
	}

	// Note: Saving credentials in environment variables is convenient, but not the most
	// secure method. For production environments, consider using a more secure solution
	// like Google Cloud Secret Manager to protect your secrets.
	var (
		dbUser                 = mustGetenv("DB_USER")                  // e.g. 'postgres'
		dbPwd                  = mustGetenv("DB_PASS")                  // e.g. 'my-secret-password'
		dbName                 = mustGetenv("DB_NAME")                  // e.g. 'pool_party'
		instanceConnectionName = mustGetenv("INSTANCE_CONNECTION_NAME") // e.g. 'project:region:instance'
	)

	// Create a new Cloud SQL dialer.
	d, err := cloudsqlconn.NewDialer(context.Background())
	if err != nil {
		return nil, fmt.Errorf("cloudsqlconn.NewDialer: %w", err)
	}

	// Configure the pgx driver to use the Cloud SQL dialer.
	config, err := pgx.ParseConfig(fmt.Sprintf("user=%s password=%s dbname=%s", dbUser, dbPwd, dbName))
	if err != nil {
		return nil, fmt.Errorf("pgx.ParseConfig: %w", err)
	}
	config.DialFunc = func(ctx context.Context, _, _ string) (net.Conn, error) {
		return d.Dial(ctx, instanceConnectionName)
	}

	// Open the database with the custom dialer.
	db, err := sql.Open("pgx", stdlib.RegisterConnConfig(config))
	if err != nil {
		return nil, fmt.Errorf("sql.Open: %w", err)
	}

	return db, nil
}
