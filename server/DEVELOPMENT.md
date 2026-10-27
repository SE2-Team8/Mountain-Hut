# Server Development Guide

## Project structure

Each folder keeps a different part of the server in one place. This makes code easier to find and change as the project grows. A request usually travels through the router, middleware, controller, service, repository, and database, then returns a response.

| Folder | What it contains and why it matters | Where it is used |
| --- | --- | --- |
| `config/` | Shared settings and connections. Keeping these together avoids repeating setup code. | `index.js` loads CORS settings; database scripts and repositories use the database connection. |
| `controllers/` | Functions that handle HTTP requests and choose the response. | Called by routes in `router/`. |
| `database/` | Scripts that create the database tables and add starting data. | Run manually with the database commands below. |
| `middlewares/` | Functions that check or handle requests before or after a controller. | Added to routes or to the whole Express app. |
| `repositories/` | Database reads and writes. This keeps SQL away from HTTP handling. | Called by services in `services/`. |
| `router/` | Maps HTTP paths and methods to middleware and controllers. | Mounted under `/api` by `index.js`. |
| `services/` | App operations between controllers and repositories. | Called by controllers. |
| `utils/` | Small shared helpers for database queries, responses, and async controllers. | Imported wherever those helpers are needed. |

## Important middleware

- `middlewares/ecxeptionHandler.js` is the shared Express error-handling middleware. Its main purpose is to ensure that errors are returned to the client using a consistent JSON response structure. Without a centralized error handler, errors may produce inconsistent responses and expose internal implementation details or sensitive information to the client. By handling errors in one place, we can control which information is exposed and make error handling more predictable and easier to manage on the frontend. This middleware is registered after the routes in `index.js`, allowing errors passed to Express to be handled centrally.
- `middlewares/isAuthenticated.js` is intended to protect routes by checking whether the request comes from an authenticated user.
- `middlewares/validator.js` handles request input validation using `express-validator`. It receives a list of validation rules, executes them, and allows the request to continue if all validations pass. Otherwise, it returns the validation errors with HTTP status 422. This keeps validation logic centralized and avoids repeating error-handling code in individual routes.
For example, to validate the name field when creating a user, you only need to define the validation rules in the router:
``` js
router.post(
    '/users',
    isAuthenticated,
    validator([
        body("name")
            .notEmpty()
            .withMessage("Name is required")
            .escape()
    ]),
    wrapController(usersController.submit)
);
```

## Important utilities

- `utils/query.js` wraps SQLite's callback-based `all`, `get`, and `run` methods in `Promises`, providing a simpler and more consistent interface for database operations. It encapsulates the database library's implementation details, reducing the coupling between the application and the underlying database library. This abstraction makes it easier to replace or change the database library in the future without requiring database-specific code to be rewritten throughout the project.
Additionally, it allows database operations to be handled using `async/await` instead of nested callbacks or manually chained `Promises`. As a result, asynchronous operations can be written sequentially, making the code easier to read, maintain, and debug.
- `utils/response.js` provides helper functions for generating consistent JSON responses. Both successful and failed responses follow the same general structure, containing success, data, and message fields. This gives the frontend a predictable response format and simplifies response handling across the application.
- `utils/wrapController.js` wraps asynchronous controller functions and forwards any errors they throw or reject with to Express's error-handling middleware. By wrapping controllers at the route level, we avoid having to repeat `try/catch` blocks in every asynchronous controller just to forward errors.
Within the project's layered architecture, this utility acts as the boundary between the controller layer and Express's centralized error-handling mechanism. Errors propagate through the application and are ultimately handled by `middlewares/exceptionHandler.js`, which returns a response consistent with the project's error-response contract.
This approach keeps controllers focused on their main responsibilities and ensures that errors are handled consistently across the application.

## Database scripts

- `database/migration.js` is a script that can be executed using a command to create the database tables defined in the project(The commands are documented in the Set up section).
- `database/seeder.js` is a script that can be executed using a command to populate the database with initial sample data(The commands are documented in the Set up section).
- `config/db.js` initializes the SQLite database connection using the database file specified by the `DB_CONNECTION` variable in the `.env` file. This centralizes the database configuration and allows the database file location to be changed through environment configuration rather than hardcoded application logic.

## Set up and run the server

Recommended Node.js version: v24.13.1

Run these commands from the `server/` directory. First, create a `.env` file there and set the SQLite file path, for example:

```env
DB_CONNECTION="database/database.sqlite"
```

Then run:

1. `npm install` — installs the server's dependencies.
2. `npm run db:migrate` — creates a fresh database.
3. `npm run db:seed` — adds the sample data to the database.
4. `node index.js` | `nodemon index.js` — starts the server.

The server listens at `http://localhost:3001`. The example API route is `GET /api/users/:id`.

### Sending Emails with `smtpService`

The `smtpService` provides two functions for sending emails using Gmail SMTP:

- `sendEmail()`: Sends an email using plain text and/or HTML content.
- `sendTemplateEmail()`: Sends an email using an HTML template stored in the `templates/` directory.

#### Using `sendTemplateEmail()`

```javascript
import { sendTemplateEmail } from "../services/smtpService.js";

await sendTemplateEmail({
    to: "recipient@example.com",
    subject: "Booking Confirmation",
    templateName: "booking-confirmation",
    data: {
        guestName: "Ab Rezaei",
        bookingReference: "sample-reference-id",
        checkIn: "2026-11-10",
        checkOut: "2026-11-13",
        items: [
            { description: "Accommodation", price: "240.00" },
            { description: "Breakfast", price: "30.00" },
        ],
        total: "270.00",
    },
    text: "Your booking has been confirmed.",
});
```

**Important notes:**
- `templateName` must match an existing HTML filename inside `templates/`, **without the `.html` extension**. For example, `booking-confirmation` refers to `templates/booking-confirmation.html`.
- The `data` object provides values for the placeholders in the HTML template (e.g., `{{guestName}}`).
