import { Pool } from "pg";
import bcrypt from "bcrypt";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const setup = async () => {
    // Dev-only: wipe the tables on boot so schema changes take effect.
    // Guarded so production never drops data. Every child table is dropped
    // explicitly (before users): a plain DROP TABLE users CASCADE only removes
    // the FK constraint, leaving orphaned rows whose user_id would re-bind to
    // a freshly reseeded testuser once SERIAL restarts at 1.
    if (process.env.NODE_ENV === "development") {
        await pool.query("DROP TABLE IF EXISTS notifications CASCADE");
        await pool.query("DROP TABLE IF EXISTS positions CASCADE");
        await pool.query("DROP TABLE IF EXISTS users CASCADE");
    }

    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            plan TEXT NOT NULL DEFAULT 'free',
            plan_expires_at TIMESTAMP DEFAULT NULL,
            stripe_customer_id TEXT DEFAULT NULL,
            email_verified BOOLEAN NOT NULL DEFAULT FALSE,
            last_login TIMESTAMP DEFAULT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            beta_access BOOLEAN NOT NULL DEFAULT FALSE,
            download_count INTEGER NOT NULL DEFAULT 0,
            tos_version_accepted TEXT DEFAULT NULL,
            tos_accepted_at TIMESTAMP DEFAULT NULL,
            eula_version_accepted TEXT DEFAULT NULL,
            eula_accepted_at TIMESTAMP DEFAULT NULL,
            subscription_status TEXT NOT NULL DEFAULT 'inactive',
            risk_tier TEXT DEFAULT NULL,
            settings JSONB NOT NULL DEFAULT '{}'::jsonb,
            member_since TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Portfolio positions, one row per (user, ticker). Created with
    // CREATE TABLE IF NOT EXISTS (same idempotent pattern as the ALTERs below) so
    // it runs in every environment and persists in prod. In dev it is dropped and
    // recreated on every boot alongside users (see the drop block above). Placed
    // after users because of the FK. NUMERIC amounts come back from node-postgres
    // as strings; the route layer coerces them (see routes/positions.ts).
    await pool.query(`
        CREATE TABLE IF NOT EXISTS positions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            ticker TEXT NOT NULL,
            shares NUMERIC NOT NULL,
            equity NUMERIC NOT NULL,
            price NUMERIC NOT NULL,
            sector TEXT DEFAULT NULL,
            name TEXT DEFAULT NULL,
            added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (user_id, ticker)
        )
    `);

    // Per-user notifications, one row per message. Created with
    // CREATE TABLE IF NOT EXISTS (same idempotent pattern as positions and the
    // ALTERs below) so it runs in every environment and persists in prod; in dev
    // it is dropped and recreated on every boot alongside users (see the drop
    // block above). Placed after users because of the FK.
    //
    // Currently WRITE-ONLY: the only writer is grantWaitlistProTime() in
    // waitlist.ts, and nothing reads it yet - the lens-app TopBar notification
    // popover is still a hardcoded "No new notifications." placeholder. A
    // GET /notifications route and the popover wiring are the follow-up.
    //
    // `type` is a free-text discriminator so the client can pick an icon later
    // ('waitlist_pro_grant' is the first and only value in use); `is_read`
    // matches the is_active naming already on users.
    await pool.query(`
        CREATE TABLE IF NOT EXISTS notifications (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            type TEXT NOT NULL DEFAULT 'general',
            message TEXT NOT NULL,
            is_read BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Idempotent migrations: add new columns if they don't exist.
    // Each is wrapped in try/catch so a transient failure doesn't prevent server boot.
    try {
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT DEFAULT NULL");
    } catch (err) {
        console.error("Failed to add verification_token column:", err);
    }

    try {
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT DEFAULT NULL");
    } catch (err) {
        console.error("Failed to add reset_token column:", err);
    }

    try {
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP DEFAULT NULL");
    } catch (err) {
        console.error("Failed to add reset_token_expires_at column:", err);
    }

    try {
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS tos_version_accepted TEXT DEFAULT NULL");
    } catch (err) {
        console.error("Failed to add tos_version_accepted column:", err);
    }

    try {
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMP DEFAULT NULL");
    } catch (err) {
        console.error("Failed to add tos_accepted_at column:", err);
    }

    try {
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS eula_version_accepted TEXT DEFAULT NULL");
    } catch (err) {
        console.error("Failed to add eula_version_accepted column:", err);
    }

    try {
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS eula_accepted_at TIMESTAMP DEFAULT NULL");
    } catch (err) {
        console.error("Failed to add eula_accepted_at column:", err);
    }

    try {
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'inactive'");
    } catch (err) {
        console.error("Failed to add subscription_status column:", err);
    }

    // The user's risk profile (low/regular/high), set during onboarding. NULL means
    // the user has not chosen one yet, i.e. a brand-new account that should still be
    // sent through onboarding. Moved here from the client-side lens_settings cookie
    // so it is per-user in Postgres, not shared across accounts on one browser.
    try {
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS risk_tier TEXT DEFAULT NULL");
    } catch (err) {
        console.error("Failed to add risk_tier column:", err);
    }

    // Per-user app settings blob (theme, date_format, dashboard layout, and the
    // analyze tuning blocks: direction_thresholds/volatility/lens_signals/monte_carlo).
    // A single JSONB column keeps this extensible without a column per setting. Moved
    // off client-side cookies/localStorage so preferences follow the account, not the
    // browser. PUT /settings shallow-merges partial updates into this object.
    try {
        await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb");
    } catch (err) {
        console.error("Failed to add settings column:", err);
    }

    // Dev-only: seed a known test account (password = "password123").
    // subscription_status is seeded as 'active' so the app is immediately usable in dev.
    if (process.env.NODE_ENV === "development") {
        const hashedPassword = await bcrypt.hash("password123", 10);
        await pool.query(
            `INSERT INTO users (username, email, password, plan, beta_access, subscription_status, risk_tier)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT DO NOTHING`,
            ["testuser", "test@protonyx.dev", hashedPassword, "free", true, "active", "regular"]
        );

        // Dev-only: seed testuser with a few sample positions so a fresh dev boot
        // lands on a populated dashboard instead of onboarding. Guarded the same
        // way as the testuser seed (dev-only, ON CONFLICT DO NOTHING). Prices are
        // plausible placeholders; the analyze path fetches live data by ticker.
        const seeded = await pool.query("SELECT id FROM users WHERE username = $1", ["testuser"]);
        const testUserId = seeded.rows[0]?.id;
        if (testUserId) {
            await pool.query(
                `INSERT INTO positions (user_id, ticker, shares, equity, price, sector, name)
                 VALUES
                    ($1, 'AAPL', 10, 2300, 230, 'Technology', 'Apple Inc.'),
                    ($1, 'MSFT', 5, 2150, 430, 'Technology', 'Microsoft Corporation'),
                    ($1, 'JPM', 8, 1600, 200, 'Financial Services', 'JPMorgan Chase & Co.')
                 ON CONFLICT (user_id, ticker) DO NOTHING`,
                [testUserId]
            );
        }
    }
};

setup().catch((err) => {
    console.error("Database setup failed:", err);
    process.exit(1);
});

export default pool;
