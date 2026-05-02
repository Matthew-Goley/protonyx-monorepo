import { Resend } from "resend";

export async function sendWelcomeEmail(to: string, username: string): Promise<void> {
    const resend = new Resend(process.env.RESEND_API_KEY);
    console.log('Resend key inside function:', !!process.env.RESEND_API_KEY);
    
    const downloadUrl = "https://protonyx.dev/download";

    const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#0b1020;font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:#e7ebf3;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b1020;">
      <tr>
        <td align="center" style="padding:48px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td style="padding-bottom:24px;">
                <h1 style="margin:0;font-size:24px;font-weight:600;color:#e7ebf3;letter-spacing:0.02em;">
                  Welcome to Protonyx, ${username}.
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:32px;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#e7ebf3;">
                  Your account is ready. You now have access to Vector, our portfolio analytics platform built for serious retail investors.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:40px;">
                <a href="${downloadUrl}" style="display:inline-block;padding:12px 24px;background-color:#2dd4bf;color:#0b1020;text-decoration:none;font-weight:600;font-size:14px;border-radius:4px;letter-spacing:0.02em;">
                  Download Vector
                </a>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #1f2937;padding-top:24px;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;">
                  You're receiving this because you created a Protonyx account.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    try {
        await resend.emails.send({
            from: "onboarding@resend.dev",
            to,
            subject: "Welcome to Protonyx",
            html,
        });
    } catch (err) {
        console.error("Failed to send welcome email:", err);
    }
}

export async function sendVerificationEmail(to: string, username: string, token: string): Promise<void> {
    const resend = new Resend(process.env.RESEND_API_KEY);

    // TODO: replace localhost with production domain
    const verifyUrl = `http://localhost:5501/verify-email/index.html?token=${token}`;

    const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#0b1020;font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:#e7ebf3;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b1020;">
      <tr>
        <td align="center" style="padding:48px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td style="padding-bottom:24px;">
                <h1 style="margin:0;font-size:24px;font-weight:600;color:#e7ebf3;letter-spacing:0.02em;">
                  Verify your email, ${username}.
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:32px;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#e7ebf3;">
                  Click the button below to verify your email address and activate your Protonyx account.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:40px;">
                <a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background-color:#2dd4bf;color:#0b1020;text-decoration:none;font-weight:600;font-size:14px;border-radius:4px;letter-spacing:0.02em;">
                  Verify Email
                </a>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #1f2937;padding-top:24px;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;">
                  You're receiving this because you created a Protonyx account. If that wasn't you, you can ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    try {
        await resend.emails.send({
            from: "onboarding@resend.dev",
            to,
            subject: "Verify your Protonyx email",
            html,
        });
    } catch (err) {
        console.error("Failed to send verification email:", err);
    }
}

export async function sendPasswordResetEmail(to: string, username: string, token: string): Promise<void> {
    const resend = new Resend(process.env.RESEND_API_KEY);

    // TODO: replace localhost with production domain
    const resetUrl = `http://localhost:5501/reset-password/index.html?token=${token}`;

    const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#0b1020;font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:#e7ebf3;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b1020;">
      <tr>
        <td align="center" style="padding:48px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td style="padding-bottom:24px;">
                <h1 style="margin:0;font-size:24px;font-weight:600;color:#e7ebf3;letter-spacing:0.02em;">
                  Password reset requested, ${username}.
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:32px;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#e7ebf3;">
                  Click the button below to reset your password. This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:40px;">
                <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background-color:#2dd4bf;color:#0b1020;text-decoration:none;font-weight:600;font-size:14px;border-radius:4px;letter-spacing:0.02em;">
                  Reset Password
                </a>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #1f2937;padding-top:24px;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;">
                  For your security, this link can only be used once and expires one hour after it was sent.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    try {
        await resend.emails.send({
            from: "onboarding@resend.dev",
            to,
            subject: "Reset your Protonyx password",
            html,
        });
    } catch (err) {
        console.error("Failed to send password reset email:", err);
    }
}
