const functions = require("firebase-functions");
const admin = require("firebase-admin");
const PocketBase = require("pocketbase/cjs");
const webpush = require("web-push");

admin.initializeApp();

const pb = new PocketBase("https://simple-chess-pb-backend.fly.dev");

// You need to set these VAPID keys in your Firebase environment
// firebase functions:config:set vapid.public_key="YOUR_PUBLIC_KEY"
// firebase functions:config:set vapid.private_key="YOUR_PRIVATE_KEY"
// The public key is the one from your notification.service.ts
const vapidDetails = {
    publicKey: functions.config().vapid.public_key,
    privateKey: functions.config().vapid.private_key,
    subject: 'mailto:you@example.com' // Replace with your email
};

exports.sendTurnNotification = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.set('Access-Control-Max-Age', '3600');
        res.status(204).send('');
        return;
    }

    const opponentId = req.body.data.opponentId;
    if (!opponentId) {
        return res.status(400).send({ error: "Missing opponentId" });
    }

    try {
        const record = await pb.collection('push_subscriptions').getFirstListItem(`user = "${opponentId}"`);
        const subscription = record.subscription;

        const payload = JSON.stringify({
            notification: {
                title: "Your Turn!",
                body: "Your opponent has made their move.",
                icon: "https://simple-chess-pb-backend.fly.dev/api/files/pbc_1863359460/b7u08j3303au1es/horse_icon_512_512_Gji32a61iR.png"
            }
        });

        // Check if it's a native FCM token (string) or a web push subscription (object)
        if (typeof subscription === 'string') {
            console.log("Sending native push to FCM token:", subscription);
            const message = {
                token: subscription,
                notification: {
                    title: "Your Turn!",
                    body: "Your opponent has made their move.",
                },
            };
            await admin.messaging().send(message);
        } else if (typeof subscription === 'object' && subscription.endpoint) {
            console.log("Sending web push to endpoint:", subscription.endpoint);
            webpush.setVapidDetails(vapidDetails.subject, vapidDetails.publicKey, vapidDetails.privateKey);
            await webpush.sendNotification(subscription, payload);
        } else {
            throw new Error("Invalid subscription format");
        }

        console.log("Successfully sent notification to opponent:", opponentId);
        return res.status(200).send({ data: { success: true } });

    } catch (error) {
        console.error("Error sending notification:", error);
        if (error.name === 'WebPushError') {
            // Handle web-push specific errors (e.g., 410 Gone for expired subscriptions)
            return res.status(error.statusCode).send({ error: error.body });
        }
        if (error.status === 404) {
            return res.status(200).send({ data: { success: false, error: "No subscription found." } });
        }
        return res.status(500).send({ error: "Internal server error" });
    }
});