import cors from "cors";

const corsConfig = cors({
    origin: (origin, callback) => {
        const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

        if (!origin || isLocalhost) {
            callback(null, true);
        } else {
            callback(new Error("CORS"));
        }
    },
    credentials: true,
});

export default corsConfig;