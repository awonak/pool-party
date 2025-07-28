# Dockerfile

# --- Build Stage 1: Frontend (React) ---
# Use a specific version of Node for reproducibility.
# 'alpine' variant is used for a smaller image size.
FROM node:18-alpine AS build-react
LABEL stage=react-builder

# Set the working directory for the frontend build
WORKDIR /app/frontend

# Copy package.json and package-lock.json to leverage Docker cache
COPY frontend/package.json frontend/package-lock.json ./
# Use 'npm ci' for faster, more reliable builds in CI/CD environments
RUN npm ci

# Copy the rest of the frontend source code
COPY frontend/ ./

# Build the production-ready static files
RUN npm run build

# --- Build Stage 2: Backend (Go) ---
# Use a specific version of Go for reproducibility.
# 'alpine' variant is used for a smaller image size.
FROM golang:1.24-alpine AS build-go
LABEL stage=go-builder

# Install git, which is required for 'go mod download' to fetch modules from git repos
RUN apk add --no-cache git

# Set the working directory for the backend build
WORKDIR /app/backend

# Copy Go module files to leverage Docker cache
COPY backend/go.mod backend/go.sum ./
# Download Go module dependencies
RUN go mod download

# Copy the rest of the backend source code
COPY backend/ ./

# Build the Go binary.
# - CGO_ENABLED=0 creates a static binary without C dependencies.
# - GOOS=linux specifies the target OS for Cloud Run.
# - -ldflags="-w -s" strips debug information to reduce binary size.
# The output is a single executable file named 'server'.
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /server .

# --- Final Stage: Production Image ---
# Use a minimal, secure 'distroless' base image.
# 'base' includes essential libraries like ca-certificates, which are
# needed for making HTTPS requests (e.g., to PayPal).
FROM gcr.io/distroless/base-debian11

WORKDIR /app

# Copy the built React static assets from the 'build-react' stage.
COPY --from=build-react /app/frontend/build ./frontend/build

# Copy the compiled Go binary from the 'build-go' stage.
COPY --from=build-go /server ./backend/server

# Set the working directory for command execution.
# This ensures that the Go server's relative path to static files ('../frontend/build') resolves correctly.
WORKDIR /app/backend

# The PORT environment variable is automatically set by Cloud Run.
# EXPOSE is good practice for documentation but not strictly required by Cloud Run.
EXPOSE 8080

# Set the command to run the application.
# The distroless image has no shell, so we use the exec form.
CMD ["./server"]