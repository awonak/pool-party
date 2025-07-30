# Makefile for Pool Party

# ==============================================================================
# Variables
#
# These are the variables you might need to change per environment.
# We recommend using separate .env files for each environment.
# ==============================================================================

# Get the project ID from your gcloud config.
PROJECT_ID ?= $(shell gcloud config get-value project)
REGION ?= us-central1
REPO_NAME ?= pool-party-repo

# --- Development Environment ---
SERVICE_NAME_DEV ?= pool-party-service-dev
DB_INSTANCE_DEV ?= pool-party-db-dev

# --- Production Environment ---
SERVICE_NAME_PROD ?= pool-party-service
DB_INSTANCE_PROD ?= pool-party-db

# Docker image names are generated automatically
IMAGE_NAME_BASE := $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(REPO_NAME)/pool-party-app
IMAGE_NAME_TAGGED := $(IMAGE_NAME_BASE):$(shell git rev-parse --short HEAD)

.PHONY: help
help:
	@echo "Usage: make <target>"
	@echo ""
	@echo "Targets:"
	@echo "  install          Install frontend and backend dependencies"
	@echo "  dev-frontend     Run the frontend development server"
	@echo "  dev-backend      Run the backend development server"
	@echo "  docker-build     Build the Docker container with the 'latest' tag"
	@echo "  docker-run-dev   Run container locally, connecting to Cloud SQL (dev)"
	@echo "  deploy-dev       Build, push, and deploy the app to the DEV environment"
	@echo "  deploy-prod      Build, push, and deploy the app to the PROD environment"
	@echo "  gcr-login        Authenticate Docker with Google Artifact Registry"

# ==============================================================================
# Development
# ==============================================================================

.PHONY: install
install:
	@echo "--> Installing frontend dependencies..."
	cd frontend && npm install
	@echo "--> Tidy backend dependencies..."
	cd backend && go mod tidy

.PHONY: dev-frontend
dev-frontend:
	@echo "--> Starting frontend development server on http://localhost:3000"
	@if [ ! -f .env.dev ]; then echo "Error: .env.dev file not found. Please create it."; exit 1; fi
	cd frontend && npm run dev

.PHONY: dev-backend
dev-backend:
	@echo "--> Starting backend development server on http://localhost:8000"
	@if [ ! -f .env.dev ]; then echo "Error: .env.dev file not found. Please create it."; exit 1; fi
	cd backend && go run main.go

# ==============================================================================
# Docker & Deployment
# ==============================================================================

.PHONY: gcr-login
gcr-login:
	@echo "--> Authenticating Docker with Google Artifact Registry for region $(REGION)..."
	gcloud auth configure-docker $(REGION)-docker.pkg.dev

.PHONY: docker-build
docker-build:
	@echo "--> Building Docker image with tag 'latest'"
	docker build -t $(IMAGE_NAME_BASE):latest .

# Internal target to build and push the version-tagged image
.PHONY: build-and-push
build-and-push: gcr-login
	@echo "--> Building and tagging image: $(IMAGE_NAME_TAGGED)"
	docker build -t $(IMAGE_NAME_TAGGED) .
	@echo "--> Pushing image to Artifact Registry: $(IMAGE_NAME_TAGGED)"
	docker push $(IMAGE_NAME_TAGGED)

.PHONY: deploy-dev
deploy-dev: build-and-push
	@echo "--> Deploying version $(shell git rev-parse --short HEAD) to DEV environment..."
	@if [ ! -f .env.dev ]; then echo "Error: .env.dev file not found. Please create it."; exit 1; fi
	INSTANCE_CONNECTION_NAME=$$(gcloud sql instances describe $(DB_INSTANCE_DEV) --project=$(PROJECT_ID) --format='value(connectionName)') && \
	source .env.dev && gcloud run deploy $(SERVICE_NAME_DEV) \
		--image=$(IMAGE_NAME_TAGGED) --platform=managed --region=$(REGION) --allow-unauthenticated \
		--add-cloudsql-instances=$${INSTANCE_CONNECTION_NAME} \
		--set-env-vars="DB_USER=$${DB_USER},DB_PASS=$${DB_PASS},DB_NAME=$${DB_NAME},INSTANCE_CONNECTION_NAME=$${INSTANCE_CONNECTION_NAME},SESSION_SECRET=$${SESSION_SECRET},GOOGLE_CLIENT_ID=$${GOOGLE_CLIENT_ID},PAYPAL_CLIENT_ID=$${PAYPAL_CLIENT_ID},PAYPAL_CLIENT_SECRET=$${PAYPAL_CLIENT_SECRET},PAYPAL_API_BASE=$${PAYPAL_API_BASE}" \
		--project=$(PROJECT_ID)

.PHONY: deploy-prod
deploy-prod: build-and-push
	@echo "--> Deploying version $(shell git rev-parse --short HEAD) to PROD environment..."
	@if [ ! -f .env.prod ]; then echo "Error: .env.prod file not found. Please create it."; exit 1; fi
	INSTANCE_CONNECTION_NAME=$$(gcloud sql instances describe $(DB_INSTANCE_PROD) --project=$(PROJECT_ID) --format='value(connectionName)') && \
	source .env.prod && gcloud run deploy $(SERVICE_NAME_PROD) \
		--image=$(IMAGE_NAME_TAGGED) --platform=managed --region=$(REGION) --allow-unauthenticated \
		--add-cloudsql-instances=$${INSTANCE_CONNECTION_NAME} \
		--set-env-vars="DB_USER=$${DB_USER},DB_PASS=$${DB_PASS},DB_NAME=$${DB_NAME},INSTANCE_CONNECTION_NAME=$${INSTANCE_CONNECTION_NAME},SESSION_SECRET=$${SESSION_SECRET},GOOGLE_CLIENT_ID=$${GOOGLE_CLIENT_ID},PAYPAL_CLIENT_ID=$${PAYPAL_CLIENT_ID},PAYPAL_CLIENT_SECRET=$${PAYPAL_CLIENT_SECRET},PAYPAL_API_BASE=$${PAYPAL_API_BASE}" \
		--project=$(PROJECT_ID)
