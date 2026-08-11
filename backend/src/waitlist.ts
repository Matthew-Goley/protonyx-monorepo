import pool from "./db";

// Earned free Pro time for a converted waitlist entry: one month for verifying
// your own email, plus one month for every verified person you referred, capped
// at a year. The count is always derived, never stored, so it cannot drift.
const BASE_MONTHS = 1;
const MAX_MONTHS = 12;

/**
 * The in-app notification announcing the grant. The expiry is spelled out as a
 * readable date ("November 11, 2026") rather than a timestamp, because this
 * string is shown to the user verbatim. The date comes from the row Postgres
 * actually wrote, so it can never disagree with plan_expires_at.
 */
function buildGrantMessage(months: number, expiresAt: Date): string {
    const readableDate = expiresAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric"
    });
    const monthWord = months === 1 ? "month" : "months";
    return `You earned ${months} ${monthWord} of free Lens Pro from the referral waitlist. Your Pro access runs until ${readableDate}.`;
}

/**
 * Converts a verified, unredeemed waitlist entry into free Pro time on a
 * freshly created user row, then stamps the entry redeemed.
 *
 * Best-effort by design and never throws. No matching entry, an unverified
 * entry, an already-redeemed entry, or a waitlist table that does not exist in
 * this environment all leave the account exactly as signup created it. Signup
 * must never fail because of this.
 *
 * Returns the number of months granted, or 0 when nothing was granted.
 */
export async function grantWaitlistProTime(userId: number, email: string): Promise<number> {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Emails are matched case-insensitively and trimmed - the waitlist row was
        // typed into a marketing form, the signup form is a separate entry point,
        // and neither normalizes casing. FOR UPDATE locks the candidate row so a
        // concurrent claim (referral-service POST /redeem) cannot double-grant it.
        const entryResult = await client.query(
            `SELECT id, referral_code
             FROM waitlist
             WHERE LOWER(TRIM(email)) = LOWER(TRIM($1))
               AND verified = TRUE
               AND redeemed = FALSE
             FOR UPDATE`,
            [email]
        );
        const entry = entryResult.rows[0] as { id: number; referral_code: string | null } | undefined;

        if (!entry) {
            await client.query("ROLLBACK");
            return 0;
        }

        // Direct verified referrals only. The referred entry's own redeemed status
        // is irrelevant - credit accrues on verification, once, for the referrer.
        let referralCount = 0;
        if (entry.referral_code) {
            const referralResult = await client.query(
                `SELECT COUNT(*)::int AS count
                 FROM waitlist
                 WHERE referred_by_code = $1
                   AND verified = TRUE
                   AND id <> $2`,
                [entry.referral_code, entry.id]
            );
            referralCount = referralResult.rows[0].count as number;
        }

        const months = Math.min(BASE_MONTHS + referralCount, MAX_MONTHS);

        // plan is the source of truth for access; plan_expires_at is what makes
        // this grant a trial rather than a permanent upgrade. GET /me expires it.
        // RETURNING hands back the expiry Postgres computed, so the notification
        // below quotes the stored date rather than re-deriving it in JS.
        const grantResult = await client.query(
            `UPDATE users
             SET plan = 'pro',
                 plan_expires_at = NOW() + make_interval(months => $1::int)
             WHERE id = $2
             RETURNING plan_expires_at`,
            [months, userId]
        );
        const expiresAt = grantResult.rows[0]?.plan_expires_at as Date | undefined;

        await client.query(
            "UPDATE waitlist SET redeemed = TRUE, redeemed_at = NOW() WHERE id = $1",
            [entry.id]
        );

        await client.query("COMMIT");

        // Notified only on this waitlist-grant path. The Stripe webhook branches
        // deliberately do NOT write a notification: a paid subscription has no
        // expiry to announce.
        //
        // Written AFTER the commit, on purpose. The grant is the precious part
        // and is already durable here. Inside the transaction this insert could
        // not be made non-fatal: Postgres aborts the whole transaction on any
        // statement error, so a failure (e.g. the table missing) would roll back
        // real earned Pro time for the sake of a cosmetic row. Out here it can
        // fail alone.
        if (expiresAt) {
            try {
                await client.query(
                    `INSERT INTO notifications (user_id, type, message)
                     VALUES ($1, 'waitlist_pro_grant', $2)`,
                    [userId, buildGrantMessage(months, expiresAt)]
                );
            } catch (err) {
                console.error("Waitlist Pro notification failed (grant unaffected):", err);
            }
        }

        return months;
    } catch (err) {
        try {
            await client.query("ROLLBACK");
        } catch {
            // Connection already unusable - nothing left to roll back.
        }
        console.error("Waitlist conversion failed (signup unaffected):", err);
        return 0;
    } finally {
        client.release();
    }
}
