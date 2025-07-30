CREATE DATABASE pool_party;

CREATE TABLE site_instance (
    id SERIAL PRIMARY KEY,
    site_title VARCHAR(255) NOT NULL,
    site_headline TEXT
);

CREATE TABLE funding_pool (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    goal_amount DECIMAL(15, 2) NOT NULL
);

CREATE TABLE ledger (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(255),
    amount DECIMAL(15, 2) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    transaction_type VARCHAR(50) NOT NULL,  -- e.g., 'deposit', 'withdrawal'
    user_google_id VARCHAR(255),
    first_name VARCHAR(255),
    last_initial VARCHAR(1),
    description TEXT,
    anonymous BOOLEAN DEFAULT FALSE
);

CREATE TABLE allocation (
    id SERIAL PRIMARY KEY,
    ledger_id INTEGER REFERENCES ledger(id),
    funding_pool_id INTEGER REFERENCES funding_pool(id),
    amount DECIMAL(15, 2) NOT NULL
);

CREATE TABLE users (
    google_id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    is_moderator BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- This alters the ledger table to reference the new users table.
-- Note: If you have existing data in `ledger`, you might need to populate
-- the `users` table first before adding this constraint.
ALTER TABLE ledger
ADD CONSTRAINT fk_user_google_id
FOREIGN KEY (user_google_id) REFERENCES users(google_id);
