import { FastifyInstance } from "fastify";
import db from "../db";
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
    
        // Check Duplicate
        const existingUser = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
    
        if (existingUser) {
            return {
                success: false,
                message: "Username Already in Use"
            };
        }
        
        // Create User and encrypt
        const hashedPassword = await bcrypt.hash(password, 10);
    
        // Push to db
        db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(username, hashedPassword);
    
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
    
        const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as { id: number; username: string; password: string } | undefined;
    
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
