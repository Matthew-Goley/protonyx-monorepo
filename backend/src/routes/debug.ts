import { FastifyInstance } from "fastify";
import pool from "../db";
import { authenticate } from "../middleware/authenticate";

export default async function debugRoutes(app: FastifyInstance) {
    // Protected route
    app.get("/protected", { preHandler: authenticate }, async (request: any) => {
        return { message: `Hello ${request.user.username}` };
    });

    // Current user profile (protected)
    // Never select password or stripe_customer_id.
    app.get("/me", { preHandler: authenticate }, async (request: any, reply: any) => {
        const result = await pool.query(
            `SELECT id, username, email, plan, plan_expires_at, member_since,
                    last_login, beta_access, download_count, email_verified, is_active
             FROM users WHERE id = $1`,
            [request.user.id]
        );
        const user = result.rows[0];

        if (!user) {
            return reply.status(401).send({
                success: false,
                message: "User not found"
            });
        }

        return reply.status(200).send({
            success: true,
            user: user
        });
    });

    // Download Counter
    app.post("/download", { preHandler: authenticate }, async (request: any) => {
        await pool.query("UPDATE users SET download_count = download_count + 1 WHERE id = $1", [request.user.id]);

        return {
            success: true,
            message: "Download recorded"
        };
    });
}
