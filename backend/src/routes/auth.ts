import { FastifyInstance } from "fastify";
import crypto from "crypto";
import pool from "../db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sendWelcomeEmail, sendVerificationEmail, sendPasswordResetEmail } from "../email";
import { CURRENT_TOS_VERSION } from "../constants";

const JWT_SECRET = process.env.JWT_SECRET as string;

export default async function authRoutes(app: FastifyInstance) {
    // Signup POST
    app.post("/signup", async (request, reply) => {
        const { username, email, password } = request.body as {
            username: string;
            email: string;
            password: string;
        }

        // Check Empty
        if (!username || !email || !password) {
            return reply.status(400).send({
                success: false,
                message: "Username, Email, and Password Required"
            });
        }

        // Check duplicate username
        const usernameCheck = await pool.query("SELECT id FROM users WHERE username = $1", [username]);
        if (usernameCheck.rows[0]) {
            return reply.status(409).send({
                success: false,
                message: "Username Already in Use"
            });
        }

        // Check duplicate email
        const emailCheck = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
        if (emailCheck.rows[0]) {
            return reply.status(409).send({
                success: false,
                message: "Email Already in Use"
            });
        }

        // Create User and encrypt
        const hashedPassword = await bcrypt.hash(password, 10);

        // Push to db. New accounts auto-accept the current TOS version at
        // creation time (the signup form carries the agreement notice).
        await pool.query(
            `INSERT INTO users (username, email, password, tos_version_accepted, tos_accepted_at)
             VALUES ($1, $2, $3, $4, NOW())`,
            [username, email, hashedPassword, CURRENT_TOS_VERSION]
        );

        // Issue email-verification token and store it on the new row
        const verificationToken = crypto.randomBytes(32).toString("hex");
        await pool.query(
            "UPDATE users SET verification_token = $1 WHERE email = $2",
            [verificationToken, email]
        );

        // Fire-and-forget transactional emails (failures are logged inside, never thrown)
        sendWelcomeEmail(email, username);
        sendVerificationEmail(email, username, verificationToken);

        return reply.status(201).send({
            success: true,
            message: "User Created"
        });
    });

    // Verify-email GET: consumes a one-time token and flips email_verified to true
    app.get("/verify-email", async (request: any, reply: any) => {
        const { token } = request.query as { token: string };

        if (!token) {
            return reply.status(400).send({
                success: false,
                message: "Invalid or expired verification token"
            });
        }

        const result = await pool.query(
            "SELECT id FROM users WHERE verification_token = $1",
            [token]
        );
        const user = result.rows[0] as { id: number } | undefined;

        if (!user) {
            return reply.status(400).send({
                success: false,
                message: "Invalid or expired verification token"
            });
        }

        await pool.query(
            "UPDATE users SET email_verified = true, verification_token = NULL WHERE id = $1",
            [user.id]
        );

        return reply.status(200).send({
            success: true,
            message: "Email verified successfully"
        });
    });

    // Forgot-password POST: issues a 1-hour reset token and emails it.
    // Always returns the same generic envelope to avoid revealing whether an
    // email is registered (account-enumeration defense).
    app.post("/forgot-password", async (request, reply) => {
        const { email } = request.body as { email?: string };

        const genericResponse = {
            success: true,
            message: "If that email exists, you will receive a reset link"
        };

        if (!email) {
            return reply.status(200).send(genericResponse);
        }

        const result = await pool.query(
            "SELECT id, username FROM users WHERE email = $1",
            [email]
        );
        const user = result.rows[0] as { id: number; username: string } | undefined;

        if (!user) {
            return reply.status(200).send(genericResponse);
        }

        const resetToken = crypto.randomBytes(32).toString("hex");
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

        await pool.query(
            "UPDATE users SET reset_token = $1, reset_token_expires_at = $2 WHERE id = $3",
            [resetToken, expires, user.id]
        );

        // Fire-and-forget, never reveal email-delivery failures to the caller
        sendPasswordResetEmail(email, user.username, resetToken);

        return reply.status(200).send(genericResponse);
    });

    // Reset-password POST: consumes a non-expired reset token and rehashes the password
    app.post("/reset-password", async (request, reply) => {
        const { token, newPassword } = request.body as { token?: string; newPassword?: string };

        if (!token || !newPassword) {
            return reply.status(400).send({
                success: false,
                message: "Token and new password are required"
            });
        }

        const result = await pool.query(
            "SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires_at > NOW()",
            [token]
        );
        const user = result.rows[0] as { id: number } | undefined;

        if (!user) {
            return reply.status(400).send({
                success: false,
                message: "Invalid or expired reset token"
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await pool.query(
            "UPDATE users SET password = $1, reset_token = NULL, reset_token_expires_at = NULL WHERE id = $2",
            [hashedPassword, user.id]
        );

        return reply.status(200).send({
            success: true,
            message: "Password reset successfully"
        });
    });

    // Login POST: accepts either username or email in the `username` field
    app.post("/login", async (request, reply) => {
        const { username, password } = request.body as {
            username: string,
            password: string
        };

        const result = await pool.query(
            "SELECT * FROM users WHERE username = $1 OR email = $1",
            [username]
        );
        const user = result.rows[0] as { id: number; username: string; password: string } | undefined;

        if (!user) {
            return reply.status(404).send({
                success: false,
                message: "User Not Found"
            });
        }

        // Compare dehashed password
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return reply.status(401).send({
                success: false,
                message: "Invalid Password"
            });
        }

        // Stamp last_login
        await pool.query("UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1", [user.id]);

        // Token
        const token = jwt.sign(
            { id: user.id, username: user.username },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        return {
            success: true,
            message: "Login Successful",
            token: token
        };
    });
}
