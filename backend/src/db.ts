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
            member_since TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

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
