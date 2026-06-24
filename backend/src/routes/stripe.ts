import { FastifyInstance } from "fastify";
import Stripe from "stripe";
import pool from "../db";
import { authenticate } from "../middleware/authenticate";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET as string;
const LENS_APP_URL = process.env.LENS_APP_URL ?? "http://localhost:5173";

export default async function stripeRoutes(app: FastifyInstance) {
    // Keep raw body as Buffer in this plugin scope - required for Stripe webhook
    // signature verification. Non-webhook routes parse body manually.
    app.addContentTypeParser("application/json", { parseAs: "buffer" }, (_, body, done) => {
        done(null, body);
    });

    // Creates a Stripe Checkout session for the $10/month subscription.
    // Returns the checkout URL for the client to redirect to.
    app.post("/stripe/create-checkout-session", { preHandler: authenticate }, async (request: any, reply: any) => {
        const userId = request.user.id;

        const result = await pool.query(
            "SELECT stripe_customer_id, email FROM users WHERE id = $1",
            [userId]
        );
        const user = result.rows[0];
        if (!user) {
            return reply.status(401).send({ success: false, message: "User not found" });
        }

        const sessionParams: Stripe.Checkout.SessionCreateParams = {
            mode: "subscription",
            payment_method_types: ["card"],
            line_items: [
                {
                    price_data: {
                        currency: "usd",
                        product_data: {
                            name: "Lens Pro",
                            description: "Lens portfolio analytics",
                        },
                        unit_amount: 1000,
                        recurring: { interval: "month" },
                    },
                    quantity: 1,
                },
            ],
            metadata: { userId: String(userId) },
            success_url: `${LENS_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${LENS_APP_URL}/portfolio`,
        };

        if (user.stripe_customer_id) {
            sessionParams.customer = user.stripe_customer_id;
        } else {
            sessionParams.customer_email = user.email;
        }

        const session = await stripe.checkout.sessions.create(sessionParams);
        return reply.send({ success: true, url: session.url });
    });

    // Creates a Stripe Customer Portal session so the user can manage billing.
    app.post("/stripe/portal", { preHandler: authenticate }, async (request: any, reply: any) => {
        const userId = request.user.id;

        const result = await pool.query(
            "SELECT stripe_customer_id FROM users WHERE id = $1",
            [userId]
        );
        const user = result.rows[0];
        if (!user?.stripe_customer_id) {
            return reply.status(400).send({ success: false, message: "No billing account found. Subscribe first." });
        }

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: user.stripe_customer_id,
            return_url: `${LENS_APP_URL}/settings`,
        });

        return reply.send({ success: true, url: portalSession.url });
    });

    // Stripe webhook endpoint - not authenticated, verified by Stripe signature.
    // Rate limiting is skipped so Stripe can deliver events without hitting the global cap.
    app.post("/stripe/webhook", { config: { rateLimit: false } }, async (request: any, reply: any) => {
        const sig = request.headers["stripe-signature"];
        const rawBody = request.body as Buffer;

        let event: Stripe.Event;
        try {
            event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
        } catch {
            return reply.status(400).send({ message: "Webhook signature verification failed" });
        }

        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                const userId = session.metadata?.userId;
                const customerId = session.customer as string;
                if (userId) {
                    await pool.query(
                        "UPDATE users SET subscription_status = 'active', stripe_customer_id = $1 WHERE id = $2",
                        [customerId, parseInt(userId, 10)]
                    );
                }
                break;
            }
            case "customer.subscription.deleted": {
                const subscription = event.data.object as Stripe.Subscription;
                const customerId = subscription.customer as string;
                await pool.query(
                    "UPDATE users SET subscription_status = 'cancelled' WHERE stripe_customer_id = $1",
                    [customerId]
                );
                break;
            }
            case "invoice.payment_failed": {
                const invoice = event.data.object as Stripe.Invoice;
                const customerId = invoice.customer as string;
                await pool.query(
                    "UPDATE users SET subscription_status = 'inactive' WHERE stripe_customer_id = $1",
                    [customerId]
                );
                break;
            }
        }

        return reply.send({ received: true });
    });
}
