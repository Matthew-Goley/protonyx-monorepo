import "dotenv/config"
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import cors from "@fastify/cors";

import authRoutes from "./routes/auth";
import debugRoutes from "./routes/debug";

const app = Fastify();

app.register(rateLimit, {
    max: 20, 
    timeWindow: 60000  // per 60 seconds (in milliseconds)
});

app.register(cors, {
    origin: [
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501"
    ],
    methods: ["GET", "POST", "DELETE", "PATCH"]
});

app.register(authRoutes);
app.register(debugRoutes);

// Start server
const start = async () => {
    try {
        await app.listen({ port: 3000 });
        console.log("Server running on http://localhost:3000");
    }   catch (err) {
        console.error(err);
        process.exit(1);
    }
};

start();