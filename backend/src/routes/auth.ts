import { FastifyInstance } from "fastify";
import pool from "../db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

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

        // Push to db
        await pool.query(
            "INSERT INTO users (username, email, password) VALUES ($1, $2, $3)",
            [username, email, hashedPassword]
        );

        return reply.status(201).send({
            success: true,
            message: "User Created"
        });
    });

    // Login POST — accepts either username or email in the `username` field
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
