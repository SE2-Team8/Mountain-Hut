# Mountain Hut — Docker instructions

The project runs as **one container**: it serves the website and API.

## What the Docker file does

- `compose.yaml` runs an image that is already published on Docker Hub.

### Before you start

1. Install and start Docker Desktop (or start Docker on Linux).
2. Open a terminal in the directory.

## Pull and run the image

The app source code and Dockerfile are not needed.

1. Start the app:

   ```sh
   docker compose up -d
   ```
2. Open <http://localhost:8080> in a browser. Check status with `docker compose ps` or view logs with `docker compose logs -f app`.
3. To stop the app while keeping its database, run this command:
   ```sh
   docker compose down
   ```

## Sample data

The sample records below are available for demonstrating the app.

### Sample accounts

| Role | Email | Password |
| --- | --- | --- |
| Warden | `marco.verdi@gmail.com` | `strong_password` |
| Employee | `luigi.rossi@libero.it` | `weak_password` |
| Hiker | `r0ssi.mari0.se2.1998@gmail.com` | `iLoveHuts` |
| Hiker | `gio.ilMucia@gmail.com` | `libellula` |

### Time slots

| Start | End | Total seats |
| --- | --- | ---: |
| March 10, 2027 12:30 | March 10, 2027 14:30 | 34 |
| March 10, 2027 18:30 | March 10, 2027 19:30 | 30 |
| March 10, 2027 19:30 | March 10, 2027 21:00 | 30 |

The seeder also creates a slot on March 11, 2027 from 12:00 to 14:00, but it has no tables and cannot be booked. No reservations are seeded, so the listed slots start with all seats available.
