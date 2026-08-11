import { FastifyInstance } from "fastify";
import pool from "../db";
import { authenticate } from "../middleware/authenticate";

// Unlike positions (whose NUMERIC columns come back as strings, see
// rowToPosition in routes/positions.ts), every notifications column maps
// cleanly: INTEGER/SERIAL -> number, BOOLEAN -> boolean, TIMESTAMP -> Date,
// which Fastify serializes to an ISO string. This mapper exists to pin the wire
// shape in one place rather than to coerce types.
function rowToNotification(row: any) {
    return {
        id: row.id,
        type: row.type,
        message: row.message,
        is_read: row.is_read,
        created_at: row.created_at
    };
}

// The popover shows a capped list, so the query is capped too. Nothing paginates
// yet; raise this (or add an offset) if a notification feed ever needs history.
const MAX_NOTIFICATIONS = 50;

export default async function notificationsRoutes(app: FastifyInstance) {
    // List the authenticated user's notifications, newest first. Read and unread
    // are returned together: the popover keeps showing a message after it has
    // been read, it just stops counting toward the unread indicator.
    // id DESC is the tiebreaker because created_at defaults to CURRENT_TIMESTAMP,
    // which is the transaction clock, so rows written in one transaction share it.
    app.get("/notifications", { preHandler: authenticate }, async (request: any, reply: any) => {
        const result = await pool.query(
            `SELECT id, type, message, is_read, created_at
             FROM notifications
             WHERE user_id = $1
             ORDER BY created_at DESC, id DESC
             LIMIT $2`,
            [request.user.id, MAX_NOTIFICATIONS]
        );
        return reply.send({ success: true, notifications: result.rows.map(rowToNotification) });
    });

    // Bulk mark-read, because the UI marks a whole popover's worth at once rather
    // than one row at a time (a per-id PATCH would mean N requests against a
    // 20/60s rate limit for a single popover open).
    //
    // `ids` is optional. The client sends the exact ids it displayed, so a
    // notification that arrives between the fetch and this call is never marked
    // read without having been seen. Omitting `ids` marks every unread row, which
    // is what a future "mark all read" control would use.
    //
    // Always ownership-scoped on user_id, so an id belonging to another account
    // silently matches nothing instead of being updated.
    app.patch("/notifications/read", { preHandler: authenticate }, async (request: any, reply: any) => {
        const body = (request.body as { ids?: unknown }) ?? {};

        if (body.ids !== undefined) {
            if (!Array.isArray(body.ids)) {
                return reply.status(400).send({ success: false, message: "ids must be an array" });
            }
            const ids = body.ids
                .map((id: unknown) => Number(id))
                .filter((id: number) => Number.isInteger(id));
            if (ids.length === 0) {
                return reply.send({ success: true, updated: 0 });
            }
            const result = await pool.query(
                `UPDATE notifications
                    SET is_read = TRUE
                    WHERE user_id = $1 AND id = ANY($2::int[]) AND is_read = FALSE`,
                [request.user.id, ids]
            );
            return reply.send({ success: true, updated: result.rowCount ?? 0 });
        }

        const result = await pool.query(
            "UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE",
            [request.user.id]
        );
        return reply.send({ success: true, updated: result.rowCount ?? 0 });
    });
}
