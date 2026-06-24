import { FastifyInstance } from "fastify";
import pool from "../db";
import { authenticate } from "../middleware/authenticate";

export default async function subscriptionRoutes(app: FastifyInstance) {
    app.get("/subscription/status", { preHandler: authenticate }, async (request: any, reply: any) => {
        const result = await pool.query(
            "SELECT subscription_status FROM users WHERE id = $1",
            [request.user.id]
        );
        const user = result.rows[0];
        if (!user) {
            return reply.status(401).send({ success: false, message: "User not found" });
        }
        return reply.send({ success: true, subscription_status: user.subscription_status });
    });
}
