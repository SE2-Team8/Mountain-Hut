import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import corsConfig from './config/corsConfig.js';
import router from './router/index.js';
import exceptionHandler from './middlewares/ecxeptionHandler.js';
import session from "express-session";
import passportConfig from "./config/passportConfig.js";

const app = express();
const port = 3001;

const clientDist = process.env.CLIENT_DIST || path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../client/dist"
  );

if (process.env.NODE_ENV === "production") {
  app.use(express.static(clientDist));
}

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));
app.use(passportConfig);
app.use(corsConfig);
app.use(express.json());
app.use('/api', router);
app.use(exceptionHandler);

if (process.env.NODE_ENV === "production") {
  app.use((request, response, next) => {
    if (
      request.method !== "GET" ||
      request.path === "/api" ||
      request.path.startsWith("/api/")
    ) {
      return next();
    }

    response.sendFile(path.join(clientDist, "index.html"));
  });
}

if (process.env.NODE_ENV !== "test")
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});

export default app;