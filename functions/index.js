const functions = require("firebase-functions");
const admin = require("firebase-admin");
const PocketBase = require("pocketbase/cjs");

admin.initializeApp();

const pb = new PocketBase("https://simple-chess-pb-backend.fly.dev");

exports.sendTurnNotification = functions.https.onCall(async (data, context) => {
    // --- START OF NEW DEBUGGING CODE ---
    console.log("Function triggered.");
    // Log the whole data object without stringify
    console.log("Received 'data' argument:", data);
    // Log the keys of the context object
    if (context) {
        console.log("Received 'context' argument with keys:", Object.keys(context));
        // Specifically log the auth object
        console.log("Value of context.auth:", context.auth);
    } else {
        console.log("Received no 'context' argument.");
    }
    // --- END OF NEW DEBUGGING CODE ---

    // Check for authentication
    if (!context || !context.auth) { // Make the check more robust
        throw new functions.https.HttpsError(
            "unauthenticated",
            "The function must be called while authenticated."
        );
    }

    // Safely extract opponentId from a potentially nested structure
    const opponentId = data.data ? data.data.opponentId : data.opponentId;
    console.log("Extracted opponentId:", opponentId);


    // Validate opponentId
    if (!opponentId) {
        console.error("Validation failed: opponentId is missing or falsy after attempting extraction.");
        throw new functions.https.HttpsError(
            "invalid-argument",
            "The function must be called with an 'opponentId'."
        );
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
            await admin.messaging().sendToDevice(subscription.endpoint, payload);
            console.log("Successfully sent notification to opponent:", opponentId);
            return { success: true };
        } else {
            console.log("No push subscription found for opponent:", opponentId);
            return { success: false, error: "No subscription found." };
        }
    } catch (error) {
        console.error("Error sending notification or querying PocketBase:", error);
        if (error.response && error.response.data) {
            console.error("PocketBase error details:", error.response.data);
        }
        throw new functions.https.HttpsError(
            "internal",
            "Failed to send notification."
        );
    }
});