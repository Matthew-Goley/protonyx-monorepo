import "dotenv/config"
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";

import authRoutes from "./routes/auth";
import debugRoutes from "./routes/debug";
import legalRoutes from "./routes/legal";
import betaRoutes from "./routes/beta";
import stripeRoutes from "./routes/stripe";
import subscriptionRoutes from "./routes/subscription";

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
        "http://localhost:5501",
        "https://protonyxdata.com",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://app.use-lens.com"
    ],
    methods: ["GET", "POST", "DELETE", "PATCH"],
    credentials: true
});

app.register(cookie);

app.register(authRoutes);
app.register(debugRoutes);
app.register(legalRoutes);
app.register(betaRoutes);
app.register(stripeRoutes);
app.register(subscriptionRoutes);

// Start server
const start = async () => {
    try {
        await app.listen({ port: Number(process.env.PORT) || 3000, host: "0.0.0.0" });
        console.log("Server running on http://localhost:3000");
    }   catch (err) {
        console.error(err);
        process.exit(1);
    }
};

start();