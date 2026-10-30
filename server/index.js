import express from "express";
import corsConfig from './config/corsConfig.js';
import router from './router/index.js';
import exceptionHandler from './middlewares/ecxeptionHandler.js';
import session from "express-session";
import passportConfig from "./config/passportConfig.js";

const app = express();
const port = 3001;

app.use(session({
  secret: "My very hard to guess secret",
  resave: false,
  saveUninitialized: false,
}));
app.use(passportConfig);
app.use(corsConfig);
app.use(express.json());
app.use('/api', router);
app.use(exceptionHandler);

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});