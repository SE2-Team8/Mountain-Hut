import "dotenv/config";
import nodemailer from "nodemailer";
import Handlebars from "handlebars";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.resolve(currentDir, "../templates");

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: true,
    auth: {
        user: process.env.SMTP_GMAIL_USER,
        pass: process.env.SMTP_GMAIL_APP_PASSWORD,
    },
});

async function sendEmail({ to, subject, text, html }) {
    const result = await transporter.sendMail({
        from: process.env.SMTP_MAIL_FROM || process.env.SMTP_GMAIL_USER,
        to,
        subject,
        text,
        html
    });

    return {
        messageId: result.messageId,
        accepted: result.accepted,
        rejected: result.rejected
    };
}

async function sendTemplateEmail({ to, subject, templateName, data, text }) {
    const templatePath = path.join(templatesDir, `${templateName}.html`);
    const templateHtml = await readFile(templatePath, "utf8");
    const render = Handlebars.compile(templateHtml);
    const html = render(data);

    return sendEmail({ to, subject, text, html });
}

export { sendEmail, sendTemplateEmail };
