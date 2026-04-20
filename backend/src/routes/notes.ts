import { FastifyInstance } from "fastify";
import pool from "../db";
import { authenticate } from "../middleware/authenticate";

export default async function noteRoutes(app: FastifyInstance) {
    // Notes (protected)
    app.post("/notes", { preHandler: authenticate }, async (request: any) => {
        const { title, content } = request.body as {
            title: string;
            content: string;
        }
    
        await pool.query("INSERT INTO notes (user_id, title, content) VALUES ($1, $2, $3)", [request.user.id, title, content]);
    
        return {
            success: true,
            message: "Note Inserted"
        };
    });
    
    // Get Notes (protected)
    app.get("/getnotes", { preHandler: authenticate }, async (request: any) => {
        const result = await pool.query("SELECT * FROM notes WHERE user_id = $1", [request.user.id]);
        const userNotes = result.rows;
    
        return {
            success: true,
            notes: userNotes
        };
    });
    
    // delete notes (protected)
    app.delete("/notes/:id", { preHandler: authenticate }, async (request: any) => {
        const { id } = request.params;

        await pool.query("DELETE FROM notes WHERE id = $1 AND user_id = $2", [id, request.user.id]);
    
        return {
            success: true,
            noteDeleted: id
        };
    });

    // update notes (protected)
    app.patch("/notes/:id", { preHandler: authenticate }, async (request: any) => {
        const { title, content } = request.body as {
            title: string,
            content: string
        };
        const { id } = request.params;

        await pool.query("UPDATE notes SET title = $1, content = $2 WHERE id = $3 and user_id = $4", [title, content, id, request.user.id]);

        return {
            success: true,
            message: "Note Updated"
        };
    });
}
