# Pool Party

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
$ docker run --rm -p 8080:8080 --env-file docker-dev.env -e PORT=8080 \
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


