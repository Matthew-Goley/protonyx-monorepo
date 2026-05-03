import { Resend } from "resend";
import {
    welcomeEmailHtml,
    verifyEmailHtml,
    resetPasswordEmailHtml,
} from "./emailTemplates";

const FROM_ADDRESS = "noreply@protonyxdata.com";

export async function sendWelcomeEmail(to: string, username: string): Promise<void> {
    const resend = new Resend(process.env.RESEND_API_KEY);
    console.log('Resend key inside function:', !!process.env.RESEND_API_KEY);

    const downloadUrl = "https://protonyx.dev/download";

    try {
        await resend.emails.send({
            from: FROM_ADDRESS,
            to,
            subject: "Welcome to Protonyx",
            html: welcomeEmailHtml(username, downloadUrl),
        });
    } catch (err) {
        console.error("Failed to send welcome email:", err);
    }
}

export async function sendVerificationEmail(to: string, username: string, token: string): Promise<void> {
    const resend = new Resend(process.env.RESEND_API_KEY);

    // TODO: replace localhost with production domain
    const verifyUrl = `http://localhost:5500/verify-email/index.html?token=${token}`;

    try {
        await resend.emails.send({
            from: FROM_ADDRESS,
            to,
            subject: "Verify your Protonyx email",
            html: verifyEmailHtml(username, verifyUrl),
        });
    } catch (err) {
        console.error("Failed to send verification email:", err);
    }
}

export async function sendPasswordResetEmail(to: string, username: string, token: string): Promise<void> {
    const resend = new Resend(process.env.RESEND_API_KEY);

    // TODO: replace localhost with production domain
    const resetUrl = `http://localhost:5500/reset-password/index.html?token=${token}`;

    try {
        await resend.emails.send({
            from: FROM_ADDRESS,
            to,
            subject: "Reset your Protonyx password",
            html: resetPasswordEmailHtml(username, resetUrl),
        });
    } catch (err) {
        console.error("Failed to send password reset email:", err);
    }
}
