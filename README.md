# Pool Party

A simple, dynamic website with defined purpose funding pools where users can make donations, choosing how to allocate across the pools, and see the transparent progress of each funding pool.

## Developer stuff

### Google Cloud Auth

```
gcloud auth login
gcloud config set project $PROJECT
```

### Local development

Frontend

```shell
$ cd frontend
$ npm install
$ npm run dev
```

Backend

```shell
$ cd backend
$ go mod tidy
$ go run main.go
```

### Docker Container Development

Build and run the container

```shell
$ docker build -t pool-party-app .
$ docker run --rm -p 8080:8080 -e PORT=8080 pool-party-app
```

Run the server connecting to CloudSQL

```shell
$ gcloud auth application-default login
$ docker run --rm -p 8080:8080 --env-file .env -e PORT=8080 \
  -v ~/.config/gcloud:/root/.config/gcloud:ro \
  pool-party-app
```

### Connect To Database

```
gcloud sql connect pool-party-db-dev --user=postgres --quiet --database=pool_party
```

Update Moderator Flag

```
pool_party=> update users set is_moderator=true where email = '<email>';
```

## Test Payments

https://developer.paypal.com/tools/sandbox/card-testing/


## Deploy to CloudRun

Build Docker Container

```shell
$ docker build -t pool-party-app .
# Replace this with your Google Cloud Project ID
export PROJECT_ID=$(gcloud config get-value project)

# Define the full image name
export IMAGE_NAME="us-central1-docker.pkg.dev/${PROJECT_ID}/pool-party-repo/pool-party-app:latest"

# Build the image
docker build -t ${IMAGE_NAME} .

# Push the image to Artifact Registry
docker push ${IMAGE_NAME}
```

Deploy container to CloudRun

```shell
# Get the full instance connection name from your Cloud SQL instance
export INSTANCE_CONNECTION_NAME=$(gcloud sql instances describe pool-party-db-dev --format='value(connectionName)')

# Get the image name we defined earlier
export IMAGE_NAME="us-central1-docker.pkg.dev/$(gcloud config get-value project)/pool-party-repo/pool-party-app:latest"

source .env && gcloud run deploy pool-party-service \
    --image=${IMAGE_NAME} \
    --platform=managed \
    --region=us-central1 \
    --allow-unauthenticated \
    --add-cloudsql-instances=${INSTANCE_CONNECTION_NAME} \
    --set-env-vars="DB_USER=${DB_USER}" \
    --set-env-vars="DB_PASS=${DB_PASS}" \
    --set-env-vars="DB_NAME=pool_party" \
    --set-env-vars="INSTANCE_CONNECTION_NAME=${INSTANCE_CONNECTION_NAME}" \
    --set-env-vars="SESSION_SECRET=${SESSION_SECRET}" \
    --set-env-vars="GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}" \
    --set-env-vars="PAYPAL_CLIENT_ID=${PAYPAL_CLIENT_ID}" \
    --set-env-vars="PAYPAL_CLIENT_SECRET=${PAYPAL_CLIENT_SECRET}" \
    --set-env-vars="PAYPAL_API_BASE=${PAYPAL_API_BASE}"
```