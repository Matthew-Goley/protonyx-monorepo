import { FastifyInstance } from "fastify";
import pool from "../db";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;

export default async function authRoutes(app: FastifyInstance) {
    // Signup POST
    app.post("/signup", async (request, reply) => {
        const { username, password } = request.body as { 
            username: string;
            password: string;
        }
    
        // Check Empty
        if (!username || !password) {
            return {
                success: false,
                message: "Username and Password Required"
            };
        }

        // Check duplicate (PostgreSQL)
        const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        const existingUser = result.rows[0];
    
        if (existingUser) {
            return {
                success: false,
                message: "Username Already in Use"
            };
        }
        
        // Create User and encrypt
        const hashedPassword = await bcrypt.hash(password, 10);

        // Push to db (PostgreSQL)
        await pool.query("INSERT INTO users (username, password) VALUES ($1, $2)", [username, hashedPassword])
    
        return {
            success: true,
            message: "User Created"
        };
    });
    
    // Login POST
    app.post("/login", async (request, reply) => {
        const { username, password } = request.body as {
            username: string,
            password: string
        };
    
        const result = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        const user = result.rows[0] as { id: number; username: string; password: string } | undefined;

        if (!user) {
            return {
                success: false,
                message: "User Not Found"
            };
        }
        
        // Compare dehashed password
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return {
                success: false,
                message: "Invalid Password"
            };
        }
    
        // Token
        const token = jwt.sign(
            { id: user.id, username: user.username},
            JWT_SECRET,
            { expiresIn: "7d"}
        );
    
        return {
            success: true,
            message: "Login Successful",
            token: token
        };
    });
}
