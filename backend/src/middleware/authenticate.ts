// middleware/authenticate.ts
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;

export const authenticate = async (request: any, reply: any) => {
    const authHeader = request.headers["authorization"];
    let token: string | undefined;

    if (authHeader) {
        token = authHeader.split(" ")[1]; // Bearer <token>
    } else if (request.cookies?.session) {
        token = request.cookies.session;
    }

    if (!token) {
        return reply.status(401).send({ success: false, message: "No token provided" });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: number; username: string };
        request.user = decoded;
    } catch {
        return reply.status(401).send({ success: false, message: "Invalid or expired token" });
    }
};