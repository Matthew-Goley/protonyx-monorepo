"""Inline HTML for the magic-link email.

Kept out of email.py so the send logic there stays scannable. Table-based
layout for broad email-client compatibility, mirroring the Protonyx brand
palette used by backend/src/emailTemplates.ts: dark navy background (#0b1020),
warm-white text (#e7ebf3), teal CTA (#2dd4bf). Branded for Lens Arc.
"""

from __future__ import annotations


def magic_link_html(verify_url: str) -> str:
    return f"""<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#0b1020;font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:#e7ebf3;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b1020;">
      <tr>
        <td align="center" style="padding:48px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td style="padding-bottom:24px;">
                <h1 style="margin:0;font-size:24px;font-weight:600;color:#e7ebf3;letter-spacing:0.02em;">
                  Confirm your early access to Lens Arc.
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:32px;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#e7ebf3;">
                  Click the button below to confirm your email. Once you do, you have a free month of Pro banked for launch, and your referral link unlocks to stack more.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:40px;">
                <a href="{verify_url}" style="display:inline-block;padding:12px 24px;background-color:#2dd4bf;color:#0b1020;text-decoration:none;font-weight:600;font-size:14px;border-radius:4px;letter-spacing:0.02em;">
                  Confirm email
                </a>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #1f2937;padding-top:24px;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;">
                  You're receiving this because someone entered this address for Lens Arc early access. If that wasn't you, you can ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def login_link_html(verify_url: str) -> str:
    """Same shell as magic_link_html, worded for a returning/already-verified
    email hitting /join again instead of a first-time confirmation."""
    return f"""<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#0b1020;font-family:'IBM Plex Mono',ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;color:#e7ebf3;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0b1020;">
      <tr>
        <td align="center" style="padding:48px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td style="padding-bottom:24px;">
                <h1 style="margin:0;font-size:24px;font-weight:600;color:#e7ebf3;letter-spacing:0.02em;">
                  Log back into Lens Arc.
                </h1>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:32px;">
                <p style="margin:0;font-size:14px;line-height:1.6;color:#e7ebf3;">
                  Click the button below to get back into your account. Your banked Pro time and referral link are right where you left them.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding-bottom:40px;">
                <a href="{verify_url}" style="display:inline-block;padding:12px 24px;background-color:#2dd4bf;color:#0b1020;text-decoration:none;font-weight:600;font-size:14px;border-radius:4px;letter-spacing:0.02em;">
                  Log in
                </a>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #1f2937;padding-top:24px;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#6b7280;">
                  You're receiving this because someone requested a login link for this address on Lens Arc. If that wasn't you, you can ignore this email.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""
