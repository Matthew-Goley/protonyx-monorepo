import { Resend } from "resend";
import {
    welcomeEmailHtml,
    verifyEmailHtml,
    resetPasswordEmailHtml,
} from "./emailTemplates";

const FROM_ADDRESS = "noreply@protonyxdata.com";

// Base URL for links in transactional emails. These land on lens-ref-web
// (lens-arc.com), which owns the pages that consume the tokens.
//
// It was previously hardcoded to protonyxdata.com, which only worked at all
// because that domain 301s to lens-arc.com. Do not point it back at a domain
// that merely redirects: the verification token rides a query string, and every
// extra hop is a chance to lose it.
const SITE_URL = (process.env.SITE_URL || "https://lens-arc.com").replace(/\/$/, "");

export async function sendWelcomeEmail(to: string, username: string): Promise<void> {
    const resend = new Resend(process.env.RESEND_API_KEY);
    console.log('Resend key inside function:', !!process.env.RESEND_API_KEY);

    const downloadUrl = "https://protonyxdata.com/#plans";

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

    // Must match ROUTES.verifyEmail in lens-ref-web/src/content.ts. That page is
    // what actually calls GET /verify-email?token=; any other path falls through
    // the SPA catch-all to the landing page, which renders fine and silently
    // drops the token, so verification fails with no error anywhere.
    const verifyUrl = `${SITE_URL}/verify-email?token=${token}`;

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

    // NOTE: lens-ref-web does not have a /reset-password page yet, so this link
    // currently falls through the SPA catch-all to the landing page and the
    // token cannot be spent. The signed-IN path (POST /change-password, used by
    // the account page) works; this signed-OUT recovery flow needs that page
    // built before it can. Kept pointed at the right domain so building the page
    // is the only remaining step.
    const resetUrl = `${SITE_URL}/reset-password?token=${token}`;

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
