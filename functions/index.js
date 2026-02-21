const functions = require("firebase-functions");
const admin = require("firebase-admin");
const PocketBase = require("pocketbase/cjs");

admin.initializeApp();

const pb = new PocketBase("https://simple-chess-pb-backend.fly.dev");

// Change to onRequest to make it a public HTTP function
exports.sendTurnNotification = functions.https.onRequest(async (req, res) => {
    // Handle CORS preflight requests
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.set('Access-Control-Max-Age', '3600');
        res.status(204).send('');
        return;
    }

    // We are now using onRequest, so we manually parse the body.
    // The client sends { data: { opponentId: '...' } }
    const opponentId = req.body.data.opponentId;

    console.log("Function triggered. Extracted opponentId:", opponentId);

    // Validate opponentId
    if (!opponentId) {
        console.error("Validation failed: opponentId is missing.");
        res.status(400).send({ error: { message: "The function must be called with an 'opponentId'." } });
        return;
    }

    try {
        const subscriptionRecord = await pb.collection('push_subscriptions').getFirstListItem(
            `user = "${opponentId}"`,
            { sort: '-created' }
        );

        if (subscriptionRecord && subscriptionRecord.subscription) {
            const subscription = subscriptionRecord.subscription;
            const payload = {
                notification: {
                    title: "Your Turn!",
                    body: "Your opponent has made their move.",
                    icon: "https://simple-chess-pb-backend.fly.dev/api/files/pbc_1863359460/b7u08j3303au1es/horse_icon_512_512_Gji32a61iR.png"
                }
            };
            // Note: sendToDevice is deprecated, consider send() with a token list
            await admin.messaging().sendToDevice(subscription.endpoint, payload);
            console.log("Successfully sent notification to opponent:", opponentId);
            res.status(200).send({ data: { success: true } });
        } else {
            console.log("No push subscription found for opponent:", opponentId);
            res.status(200).send({ data: { success: false, error: "No subscription found." } });
        }
    } catch (error) {
        console.error("Error sending notification or querying PocketBase:", error);
        // Check if the error is from PocketBase saying "not found"
        if (error.status === 404) {
             console.log("No push subscription found for opponent (PocketBase 404):", opponentId);
             res.status(200).send({ data: { success: false, error: "No subscription found." } });
        } else {
            res.status(500).send({ error: { message: "Failed to send notification." } });
        }
    }
});