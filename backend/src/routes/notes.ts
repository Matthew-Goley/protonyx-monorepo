import { FastifyInstance } from "fastify";
import db from "../db";
import { authenticate } from "../middleware/authenticate";

export default async function noteRoutes(app: FastifyInstance) {
    // Notes (protected)
    app.post("/notes", { preHandler: authenticate }, async (request: any) => {
        const { title, content } = request.body as {
            title: string;
            content: string;
        }
    
        db.prepare("INSERT INTO notes (user_id, title, content) VALUES (?, ?, ?)").run(request.user.id, title, content);
    
        return {
            success: true,
            message: "Note Inserted"
        };
    });
    
    // Get Notes (protected)
    app.get("/getnotes", { preHandler: authenticate }, async (request: any) => {
        const userNotes = db.prepare("SELECT * FROM notes WHERE user_id = ?").all(request.user.id);
    
        return {
            success: true,
            notes: userNotes
        };
    });
    
    // delete notes (protected)
    app.delete("/notes/:id", { preHandler: authenticate }, async (request: any) => {
        const { id } = request.params;
    
        db.prepare("DELETE FROM notes WHERE id = ? AND user_id = ?").run(id, request.user.id);
    
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

        db.prepare("UPDATE notes SET title = ?, content = ? WHERE id = ? and user_id = ?").run(title, content, id, request.user.id);

        return {
            success: true,
            message: "Note Updated"
        };
    });
}
