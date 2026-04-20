import { FastifyInstance } from "fastify";
import db from "../db";
import { authenticate } from "../middleware/authenticate";

export default async function debugRoutes(app: FastifyInstance) {
    // Protected route
    app.get("/protected", { preHandler: authenticate }, async (request: any) => {
        return { message: `Hello ${request.user.username}` };
    });
}