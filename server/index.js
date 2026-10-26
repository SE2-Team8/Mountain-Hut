import express from "express";
import corsConfig from './config/corsConfig.js';
import router from './router/index.js';
import ecxeptionHandler from './middlewares/ecxeptionHandler.js';

const app = express();
const port = 3001;

app.use(corsConfig);
app.use(express.json());
app.use('/api', router);
app.use(ecxeptionHandler);

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});