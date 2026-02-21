const functions = require("firebase-functions");
const admin = require("firebase-admin");
const PocketBase = require("pocketbase/cjs");
const webpush = require("web-push");
const { defineString } = require('firebase-functions/params');

// Initialize Firebase Admin SDK
admin.initializeApp();

// Initialize PocketBase client - DO NOT AUTHENTICATE HERE
const pb = new PocketBase("https://simple-chess-pb-backend.fly.dev");

// Define secrets that will be loaded at runtime
const VAPID_PUBLIC_KEY = defineString('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = defineString('VAPID_PRIVATE_KEY');
const PB_ADMIN_EMAIL = defineString('PB_ADMIN_EMAIL');
const PB_ADMIN_PASSWORD = defineString('PB_ADMIN_PASSWORD');


exports.sendTurnNotification = functions.https.onRequest(async (req, res) => {
    // Set CORS headers
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.set('Access-Control-Max-Age', '3600');
        res.status(204).send('');
        return;
    }

    try {
        // --- AUTHENTICATION LOGIC MOVED HERE ---
        // Authenticate with PocketBase only if the token is invalid or expired
        if (!pb.authStore.isValid) {
            console.log("PocketBase client is not authenticated. Authenticating as admin...");
            await pb.admins.authWithPassword(PB_ADMIN_EMAIL.value(), PB_ADMIN_PASSWORD.value());
            console.log("Successfully authenticated with PocketBase as Admin.");
        }

        const opponentId = req.body.data.opponentId;
        if (!opponentId) {
            console.error("Validation failed: opponentId is missing.");
            return res.status(400).send({ error: "Missing opponentId" });
        }

        console.log(`Attempting to find subscription for opponent: ${opponentId}`);
        const record = await pb.collection('push_subscriptions').getFirstListItem(`user = "${opponentId}"`);
        const subscription = record.subscription;
        console.log(`Found subscription for opponent ${opponentId}`);

        const payload = JSON.stringify({
            notification: {
                title: "Your Turn!",
                body: "Your opponent has made their move.",
                icon: "https://simple-chess-pb-backend.fly.dev/api/files/pbc_1863359460/b7u08j3303au1es/horse_icon_512_512_Gji32a61iR.png"
            }
        });

        if (typeof subscription === 'string') {
            console.log("Sending native push to FCM token:", subscription);
            const message = { token: subscription, notification: { title: "Your Turn!", body: "Your opponent has made their move." } };
            await admin.messaging().send(message);
        } else if (typeof subscription === 'object' && subscription.endpoint) {
            console.log("Sending web push to endpoint:", subscription.endpoint);
            webpush.setVapidDetails('mailto:example@yourdomain.org', VAPID_PUBLIC_KEY.value(), VAPID_PRIVATE_KEY.value());
            await webpush.sendNotification(subscription, payload);
        } else {
            throw new Error(`Invalid subscription format for user ${opponentId}`);
        }

        console.log("Successfully sent notification to opponent:", opponentId);
        return res.status(200).send({ data: { success: true } });

    } catch (error) {
        console.error(`Error in function execution:`, error);
        if (error.status === 404) {
            return res.status(200).send({ data: { success: false, error: "No subscription found for opponent." } });
        }
        return res.status(500).send({ error: "Internal server error" });
    }
});