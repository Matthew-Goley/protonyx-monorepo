import { Pool } from "pg";
import bcrypt from "bcrypt";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

const setup = async () => {
    // Dev-only: wipe the users table on boot so schema changes take effect.
    // Guarded so production never drops data.
    if (process.env.NODE_ENV === "development") {
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
            member_since TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
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

    // Dev-only: seed a known test account (password = "password123").
    if (process.env.NODE_ENV === "development") {
        const hashedPassword = await bcrypt.hash("password123", 10);
        await pool.query(
            `INSERT INTO users (username, email, password, plan, beta_access)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT DO NOTHING`,
            ["testuser", "test@protonyx.dev", hashedPassword, "free", true]
        );
    }
};

setup();

export default pool;
