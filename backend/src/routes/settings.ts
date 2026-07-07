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

    // Merge a partial settings object into the user's JSONB settings blob (theme,
    // date_format, layout, and the analyze tuning blocks). Uses Postgres jsonb
    // concatenation (`||`), which is a SHALLOW top-level merge: any key present in
    // the body replaces that whole key. The client therefore sends each nested block
    // (e.g. volatility) complete, never a partial block. Returns the full merged blob.
    app.put("/settings", { preHandler: authenticate }, async (request: any, reply: any) => {
        const patch = request.body;

        // Must be a plain JSON object (not null, not an array).
        if (patch === null || typeof patch !== "object" || Array.isArray(patch)) {
            return reply.status(400).send({ success: false, message: "settings must be a JSON object" });
        }

        const result = await pool.query(
            "UPDATE users SET settings = settings || $1::jsonb WHERE id = $2 RETURNING settings",
            [JSON.stringify(patch), request.user.id]
        );

        if (result.rowCount === 0) {
            return reply.status(401).send({ success: false, message: "User not found" });
        }

        return reply.send({ success: true, settings: result.rows[0].settings });
    });
}
