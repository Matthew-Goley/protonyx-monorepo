import { FastifyInstance } from "fastify";
import pool from "../db";
import { BETA_ACTIVE, MAX_BETA_USERS } from "../betaConfig";

export default async function betaRoutes(app: FastifyInstance) {
    // Public beta status (no auth). Lets the frontend reflect whether signups
    // are currently open and how many spots are left.
    app.get("/beta/status", async (_request, reply) => {
        const result = await pool.query("SELECT COUNT(*) FROM users");
        const count = parseInt(result.rows[0].count, 10);

        const open = BETA_ACTIVE && count < MAX_BETA_USERS;
        const spots_remaining = BETA_ACTIVE ? Math.max(0, MAX_BETA_USERS - count) : 0;

        return reply.status(200).send({
            success: true,
            open,
            spots_remaining
        });
    });
}
