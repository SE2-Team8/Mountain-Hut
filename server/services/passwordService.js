import { createHash, randomBytes } from "node:crypto";
import { setInitialPassword, storePasswordSetupToken,
    storePasswordResetToken, getPasswordResetToken, clearPasswordResetToken, resetPasswordWithToken
 } from "../repositories/userRepository.js";
import { sendTemplateEmail } from "./smtpService.js";

const LINK_LIFETIME_MS = 24 * 60 * 60 * 1000;
const LINK_LIFETIME_RESET = 15 * 60 * 1000;

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

// sends the email with the link to set  a new password (forgot password)
async function sendPasswordResetEmail(user) {
    const origin = getFrontendOrigin();
    if (!origin) throw new Error("PUBLIC_APP_URL is missing or not valid: the reset link cannot be built");

    const token = randomBytes(32).toString("hex");
    await storePasswordResetToken(user.userId, hashToken(token), Date.now() + LINK_LIFETIME_RESET);

    const resetUrl = new URL("/auth/reset-password", origin);
    resetUrl.hash = new URLSearchParams({ token }).toString();

    await sendTemplateEmail({
        to: user.email,
        subject: "Reset your Mountain Hut password",
        templateName: "password-reset",
        data: { fullName: user.fullName, resetUrl: resetUrl.href },
        text: `Hello, ${user.fullName}!\n\nTo set a new password for your Mountain Hut account, open ${resetUrl.href}\n\n`
            + "This link expires in 15 minutes and can be used once. If you did not ask for it, please contact us.",
    });
}

// returns {userId, expiresAt} for the reset token
function findPasswordResetToken(token) {
    return getPasswordResetToken(hashToken(token));
}

// removes the reset token of the user
function discardPasswordResetToken(userId) {
    return clearPasswordResetToken(userId);
}

// sets the new password with the reset token: true if done, false if the token is not valid, expired or just used
function completePasswordReset(token, password) {
    return resetPasswordWithToken(hashToken(token), password);
}

export { completePasswordSetup, sendPasswordSetupEmail, sendPasswordResetEmail, findPasswordResetToken,
    discardPasswordResetToken, completePasswordReset
 };
