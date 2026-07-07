import { FastifyInstance } from "fastify";
import pool from "../db";
import { authenticate } from "../middleware/authenticate";

// Allowed risk tiers. NULL is also accepted (via the body) to clear the tier,
// e.g. Settings "Clear Data & Restart Onboarding" resets a user to no-info state.
const VALID_TIERS = ["low", "regular", "high"];

export default async function settingsRoutes(app: FastifyInstance) {
    // Persist the user's risk profile to Postgres (per user). Replaces the old
    // client-side lens_settings cookie. Accepts one of low/regular/high, or null
    // to clear it. The current value is read back via GET /me (risk_tier field).
    app.put("/settings/risk-tier", { preHandler: authenticate }, async (request: any, reply: any) => {
        const { risk_tier } = request.body ?? {};

        if (risk_tier !== null && !VALID_TIERS.includes(risk_tier)) {
            return reply.status(400).send({
                success: false,
                message: "risk_tier must be one of low, regular, high, or null"
            });
        }

        const result = await pool.query(
            "UPDATE users SET risk_tier = $1 WHERE id = $2 RETURNING risk_tier",
            [risk_tier, request.user.id]
        );

        if (result.rowCount === 0) {
            return reply.status(401).send({ success: false, message: "User not found" });
        }

        return reply.send({ success: true, risk_tier: result.rows[0].risk_tier });
    });
}
