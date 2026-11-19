## Set up and run the server

Recommended Node.js version: v24.13.1

Copy `.env.example` to `.env`.

Then run:

1. `npm install` — installs the server's dependencies.
2. `npm run db:migrate` — creates a fresh database.
3. `npm run db:seed` — adds the sample data to the database.
4. `npm run db:rebuild` — recreates the database and adds the sample data.
5. `node index.js` | `nodemon index.js` — starts the server.

## Running the server tests

From the `server/` directory:

1. `npm install`
2. `npm test` — runs all tests once (Vitest)
3. `npm run test:watch` — re-runs the tests on every file change

Tests live in `server/tests/` and are named `*.test.js`.
The repository tests mock `utils/query.js`, so no database is needed.
