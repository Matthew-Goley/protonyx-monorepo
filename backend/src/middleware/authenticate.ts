// middleware/authenticate.ts
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;

// Authenticate func
export const authenticate = async (request: any, reply: any) => {
    const authHeader = request.headers["authorization"];

    if (!authHeader) {
        return reply.status(401).send({ success: false, message: "No token provided" });

    }

    const token = authHeader.split(" ")[1]; // pulls token out of "Bearer <token>"

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string };
        request.user = decoded; // attach user info to request
    } catch {
        return reply.status(401).send({ success: false, message: "Invalid or expired token" });
    }
};