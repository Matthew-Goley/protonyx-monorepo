import { FastifyInstance } from "fastify";
import pool from "../db";
import { authenticate } from "../middleware/authenticate";

// node-postgres returns NUMERIC columns as strings. The lens-app Position type
// expects numbers (shares/equity/price), so coerce every position through this
// single mapper before it goes on the wire.
function rowToPosition(row: any) {
    return {
        ticker: row.ticker,
        shares: Number(row.shares),
        equity: Number(row.equity),
        price: Number(row.price),
        sector: row.sector ?? undefined,
        name: row.name ?? undefined,
        added_at: row.added_at
    };
}

export default async function positionsRoutes(app: FastifyInstance) {
    // List the authenticated user's positions, oldest first.
    app.get("/positions", { preHandler: authenticate }, async (request: any, reply: any) => {
        const result = await pool.query(
            "SELECT ticker, shares, equity, price, sector, name, added_at FROM positions WHERE user_id = $1 ORDER BY added_at ASC",
            [request.user.id]
        );
        return reply.send({ success: true, positions: result.rows.map(rowToPosition) });
    });

    // Bulk replace (used by onboarding "Launch Lens"): wipe the user's positions
    // and insert the provided set atomically.
    app.put("/positions", { preHandler: authenticate }, async (request: any, reply: any) => {
        const body = request.body as { positions?: any[] };
        if (!body || !Array.isArray(body.positions)) {
            return reply.status(400).send({ success: false, message: "positions array is required" });
        }

        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            await client.query("DELETE FROM positions WHERE user_id = $1", [request.user.id]);
            for (const p of body.positions) {
                if (!p || typeof p.ticker !== "string") {
                    throw new Error("Each position requires a ticker");
                }
                await client.query(
                    `INSERT INTO positions (user_id, ticker, shares, equity, price, sector, name, added_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, CURRENT_TIMESTAMP))`,
                    [
                        request.user.id,
                        p.ticker,
                        Number(p.shares),
                        Number(p.equity),
                        Number(p.price),
                        p.sector ?? null,
                        p.name ?? null,
                        p.added_at ?? null
                    ]
                );
            }
            await client.query("COMMIT");
        } catch (err) {
            await client.query("ROLLBACK");
            return reply.status(400).send({ success: false, message: "Failed to save positions" });
        } finally {
            client.release();
        }

        const result = await pool.query(
            "SELECT ticker, shares, equity, price, sector, name, added_at FROM positions WHERE user_id = $1 ORDER BY added_at ASC",
            [request.user.id]
        );
        return reply.send({ success: true, positions: result.rows.map(rowToPosition) });
    });

    // Add one position. Upserts on (user_id, ticker) - matches the client's
    // AddPositionModal behavior, which replaces any existing same-ticker holding.
    app.post("/positions", { preHandler: authenticate }, async (request: any, reply: any) => {
        const p = request.body as any;
        if (!p || typeof p.ticker !== "string" || p.shares === undefined || p.price === undefined || p.equity === undefined) {
            return reply.status(400).send({ success: false, message: "ticker, shares, price and equity are required" });
        }

        const result = await pool.query(
            `INSERT INTO positions (user_id, ticker, shares, equity, price, sector, name, added_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, CURRENT_TIMESTAMP))
             ON CONFLICT (user_id, ticker) DO UPDATE
                SET shares = EXCLUDED.shares,
                    equity = EXCLUDED.equity,
                    price = EXCLUDED.price,
                    sector = EXCLUDED.sector,
                    name = EXCLUDED.name
             RETURNING ticker, shares, equity, price, sector, name, added_at`,
            [
                request.user.id,
                p.ticker,
                Number(p.shares),
                Number(p.equity),
                Number(p.price),
                p.sector ?? null,
                p.name ?? null,
                p.added_at ?? null
            ]
        );
        return reply.status(201).send({ success: true, position: rowToPosition(result.rows[0]) });
    });

    // Edit a holding's share count. Recomputes equity = shares * stored price so
    // the wire shape stays consistent (matches usePositionsManager.updateShares).
    app.patch("/positions/:ticker", { preHandler: authenticate }, async (request: any, reply: any) => {
        const { ticker } = request.params as { ticker: string };
        const { shares } = (request.body as { shares?: number }) ?? {};
        if (shares === undefined || !Number.isFinite(Number(shares)) || Number(shares) <= 0) {
            return reply.status(400).send({ success: false, message: "A positive shares value is required" });
        }

        const result = await pool.query(
            `UPDATE positions
                SET shares = $3, equity = price * $3
                WHERE user_id = $1 AND ticker = $2
                RETURNING ticker, shares, equity, price, sector, name, added_at`,
            [request.user.id, ticker, Number(shares)]
        );
        if (result.rowCount === 0) {
            return reply.status(404).send({ success: false, message: "Position not found" });
        }
        return reply.send({ success: true, position: rowToPosition(result.rows[0]) });
    });

    // Delete a holding, ownership-scoped.
    app.delete("/positions/:ticker", { preHandler: authenticate }, async (request: any, reply: any) => {
        const { ticker } = request.params as { ticker: string };
        const result = await pool.query(
            "DELETE FROM positions WHERE user_id = $1 AND ticker = $2",
            [request.user.id, ticker]
        );
        if (result.rowCount === 0) {
            return reply.status(404).send({ success: false, message: "Position not found" });
        }
        return reply.send({ success: true, message: "Position removed" });
    });
}
