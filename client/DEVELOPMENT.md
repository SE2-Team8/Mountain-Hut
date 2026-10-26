# Client Development Guide

## Project structure

The client is a React app. Its files are grouped by responsibility so pages, shared components, API calls, and app-wide behavior can be changed independently. A typical screen is selected by the router, rendered inside a layout, and can call an API module to communicate with the server.

| Folder | What it contains and why it matters | Where it is used |
| --- | --- | --- |
| `public/` | Files served directly without being imported by JavaScript, such as the favicon. | `index.html` loads `/favicon.ico` from here. |
| `src/api/` | Named functions for calling server endpoints. Keeping endpoint details together avoids scattering URLs through pages. | Pages call these functions when they need server data. |
| `src/assets/` | App images and global CSS. This keeps visual resources together. | Components import images; `main.jsx` loads the global stylesheet. |
| `src/components/` | Reusable interface pieces. Shared components keep the UI consistent and reduce repeated markup. | Pages and layouts compose these components. |
| `src/layouts/` | Shared page frames, such as the main navigation or centered login layout. | Nested routes render inside a layout through React Router's `Outlet`. |
| `src/lib/` | Shared code for HTTP requests and class-name handling. | API modules and UI components use these helpers. |
| `src/middlewares/` | Route middleware for app-wide route behavior, such as authentication checks. | Can be attached to routes in `router/`. |
| `src/pages/` | Components for individual screens, including the home, login, and not-found pages. | Selected by the routes in `router/`. |
| `src/router/` | URL-to-page mapping and nested layout setup. | `main.jsx` gives this router to React Router. |
| `src/store/` | Shared client-side state. This avoids passing the same state through many component levels. | Components or middleware can read or update the Zustand store. |
| `src/utils/` | Small helpers for shared tasks such as formatting dates. | Imported by pages and components that need them. |

## API, authentication, and shared helpers

- `src/lib/http-client.js` creates the shared Axios client. Its base URL comes from `VITE_BASE_API`, and `withCredentials: true` allows browser requests to include credentials such as cookies. It displays toast messages for failed requests, with special handling for HTTP 401, 403, and 422 responses. The 401 handler creates a React Router redirect result, but the calling code currently ignores that result; it returns the Axios error instead, so this handler does not currently navigate to the login page.
- `src/middlewares/auth.js` is an authentication middleware template. It currently just calls `next()`, so it allows access without checking a user. It is also not currently attached to an active route. The user store does not yet provide the `getAuthenticatedUser()` method shown in the middleware's example comment.

## Set up and run the client

Recommended Node.js version: v24.13.1

Run these commands from the `client/` directory. Copy `.env.example` to `.env` containing this variable:

```env
VITE_BASE_API="http://localhost:3001/api"
```

Then run:

1. `npm install` — installs the client dependencies.
2. `npm run dev` — starts development server. Keep the server running in a separate terminal for API requests.
