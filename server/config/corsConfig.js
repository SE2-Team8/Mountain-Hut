import cors from "cors";
import "dotenv/config";

const allowedOrigins = new Set(
    (process.env.CORS_ORIGINS || "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
);

const corsConfig = cors({
    origin: (origin, callback) => {
        const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

        if (!origin || isLocalhost || allowedOrigins.has(origin)) {
            callback(null, true);
        } else {
            callback(new Error("CORS"));
        }
    },
    credentials: true,
});

export default corsConfig;
