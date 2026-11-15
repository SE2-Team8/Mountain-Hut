# Mountain Hut — Docker instructions

The project runs as **one container**: it serves the website and API, and stores the database in a Docker-managed volume.

## What the Docker files do

- `Dockerfile` builds the single application image.
- Root `compose.yaml` builds and runs your current local code as `mountain-hut-local:dev`.
- Root `compose.publish.yaml` is a small override used with `compose.yaml` when tagging and pushing a release to Docker Hub. It does not define another container.
- `deployment/compose.yaml` runs an image that is already published on Docker Hub. It is for the computer that will use the app.

## 1. Start the project on your computer

### Before you start

1. Install and start Docker Desktop (or start Docker on Linux).
2. Open a terminal in the project root directory (the folder containing `compose.yaml` and `Dockerfile`).
3. Check that Docker is running by entering:

   ```sh
   docker --version
   docker compose version
   ```

### Create the Docker settings files

The Docker setup needs a root `.env` file and a backend `server/.env` file. The `.env.example` files are templates. Run these commands in the project root directory (the folder containing `compose.yaml`):

```sh
cp .env.example .env
cp server/.env.example server/.env
```

These commands create these files:

```text
Mountain-Hut/.env
Mountain-Hut/server/.env
```

Now open `server/.env` in VS Code. Find `SESSION_SECRET=` and give it a long, private value. You can generate one by running `openssl rand -hex 32` in the terminal, then copying the result after `SESSION_SECRET=`. If OpenSSL is unavailable, use a password manager to generate a random secret. SMTP settings are only needed if the app will send email. Leave `DB_CONNECTION` as shown; Docker sets the database location for you.


`client/.env` is only needed when running the frontend in Vite's development mode. `API_PROXY_TARGET` tells Vite where to forward `/api` requests during development. Docker builds the frontend into static files and serves those files and the API from the same container, so it does not use Vite's proxy or need `client/.env`.

If you also want to run the frontend in development mode, create the optional client settings file from the project root:

```sh
cp client/.env.example client/.env
```

Then, from the project root, start the frontend in development mode. The backend must be running at the address in `API_PROXY_TARGET`:

```sh
cd client
npm run dev
```

### Build and start the app

In the project folder, run:

```sh
docker compose up --build -d
```

**This runs your local project code.** In `compose.yaml`, `build.context: .` points to this project folder, and `--build` tells Compose to build an image from those files before starting it. The local image is named `mountain-hut-local:dev`, so it is easy to distinguish from a Docker Hub image. The first build can take a few minutes.

To run the image already published on Docker Hub, follow section 3 below. That flow uses `deployment/compose.yaml` and does not build from project source.

Open <http://localhost:8080> in your browser. To see the app's output, run this in the project folder:

```sh
docker compose logs -f app
```

To stop the app, run this from the project folder:

```sh
docker compose down
```

This stops and removes the container, but keeps the database. Run this from the project folder later to start it again:

```sh
docker compose up -d
```

To use a different local port, change `WEB_PORT` in the root `.env` and use that port in the browser address.

## 2. Publish the image to Docker Hub

Do this once for each release. You need a Docker Hub account.

1. Sign in to Docker Hub and create a repository named `mountain-hut`.
2. In the project folder, open the root `.env` file. Set these two lines to your Docker Hub username and the version you are publishing. For example:

   ```dotenv
   DOCKERHUB_NAMESPACE=your-dockerhub-username
   IMAGE_TAG=1.0.0
   ```

   Replace `your-dockerhub-username` with your real Docker Hub username. Keep the same `IMAGE_TAG` for both publishing and pulling this release.
3. In the project folder's terminal, sign in to Docker Hub:

   ```sh
   docker login
   ```

4. Build the image with the Docker Hub name and upload it. These commands use `compose.publish.yaml` to give the release image the username and version from the root `.env`:

   ```sh
   docker compose -f compose.yaml -f compose.publish.yaml build app
   docker compose -f compose.yaml -f compose.publish.yaml push app
   ```

   The image name for the example above is `your-dockerhub-username/mountain-hut:1.0.0`. Share this name with anyone who needs to run the app. Your regular `docker compose up --build -d` command continues to use `mountain-hut-local:dev`. Do not share your `.env` files or Docker Hub password.

## 3. Pull and run the image on another computer

These steps need Docker, the `deployment` folder, and the published image. The app source code and Dockerfile are not needed on the computer that runs it.

1. Copy the project's `deployment` folder to the computer that will run the app. It contains the Compose file and an example settings file:

   ```text
   deployment/compose.yaml
   deployment/.env.example
   ```

   Keep both files together in a folder named `deployment`.
2. Open a terminal in that `deployment` folder. Copy the example settings file to create your private settings file:


   ```sh
   cp .env.example .env
   ```

3. Open `deployment/.env` in a text editor. Set `DOCKERHUB_IMAGE` to the image name shared by the publisher, for example `your-dockerhub-username/mountain-hut:1.0.0`. Set `SESSION_SECRET` to a new random value; generate one with `openssl rand -hex 32` or a password manager. Leave `WEB_PORT=8080` to use the default address. Keep this `.env` file private.
4. If the Docker Hub repository is private, sign in with `docker login`. Public repositories do not require sign-in.
5. From the same `deployment` folder, start the app:

   ```sh
   docker compose up -d
   ```

   Compose pulls the image named in `.env`, starts it, and keeps the SQLite database in a persistent Docker volume. The image is configured to be pulled from Docker Hub each time this command runs.
6. Open <http://localhost:8080> in a browser on that computer. Check status with `docker compose ps` or view logs with `docker compose logs -f app`.

To stop the app while keeping its database, run this from the `deployment` folder:

```sh
docker compose down
```
