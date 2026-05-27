import { FastifyInstance } from "fastify";
import pool from "../db";
import { authenticate } from "../middleware/authenticate";
import { CURRENT_TOS_VERSION } from "../legalVersions";

export default async function legalRoutes(app: FastifyInstance) {
    // Legal acceptance status (protected).
    // tos_accepted is true only when the user's stored version matches the
    // current version; a NULL or stale stored version returns false.
    app.get("/legal/status", { preHandler: authenticate }, async (request: any, reply: any) => {
        const result = await pool.query(
            "SELECT tos_version_accepted FROM users WHERE id = $1",
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
            tos_accepted: user.tos_version_accepted === CURRENT_TOS_VERSION,
            current_tos_version: CURRENT_TOS_VERSION
        });
    });

    // Record acceptance of a legal document (protected).
    // Only "tos" is supported today; anything else is rejected.
    app.post("/legal/accept", { preHandler: authenticate }, async (request: any, reply: any) => {
        const { document } = request.body as { document?: string };

        if (document !== "tos") {
            return reply.status(400).send({
                success: false,
                message: "Invalid document"
            });
        }

        await pool.query(
            "UPDATE users SET tos_version_accepted = $1, tos_accepted_at = NOW() WHERE id = $2",
            [CURRENT_TOS_VERSION, request.user.id]
        );

        return reply.status(200).send({
            success: true,
            message: "Terms of Service accepted"
        });
    });
}
