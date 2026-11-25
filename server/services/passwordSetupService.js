import { createHash, randomBytes } from "node:crypto";
import { setInitialPassword, storePasswordSetupToken } from "../repositories/userRepository.js";
import { sendTemplateEmail } from "./smtpService.js";

const LINK_LIFETIME_MS = 24 * 60 * 60 * 1000;

function hashToken(token) {
    return createHash("sha256").update(token).digest("hex");
}

function getFrontendOrigin() {
    const url = URL.parse(process.env.PUBLIC_APP_URL?.trim());
    if (!url || !["http:", "https:"].includes(url.protocol)) return null;
    if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) return null;
    return url.origin;
}

async function sendPasswordSetupEmail(user) {
    const origin = getFrontendOrigin();

    const token = randomBytes(32).toString("hex");
    const stored = await storePasswordSetupToken(user.userId, hashToken(token), Date.now() + LINK_LIFETIME_MS);
    if (!stored) return false;

    const setupUrl = new URL("/auth/setup-password", origin);
    setupUrl.hash = new URLSearchParams({ token }).toString();

    await sendTemplateEmail({
        to: user.email,
        subject: "Set up your Mountain Hut password",
        templateName: "password-setup",
        data: { fullName: user.fullName, setupUrl: setupUrl.href },
        text: `Hello, ${user.fullName}!\n\nMountain Hut staff created an account for you. Set your password at ${setupUrl.href}\n\n`
            + "This link expires in 24 hours and can be used once.",
    });
    return true;
}

function completePasswordSetup(token, password) {
    return setInitialPassword(hashToken(token), password);
}

export { completePasswordSetup, sendPasswordSetupEmail };
