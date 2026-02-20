const functions = require("firebase-functions");
const admin = require("firebase-admin");
const PocketBase = require("pocketbase/cjs");

admin.initializeApp();

// Initialize PocketBase
const pb = new PocketBase("https://simple-chess-pb-backend.fly.dev");

exports.sendTurnNotification = functions.https.onCall(async (data, context) => {
    // --- START OF NEW DEBUGGING CODE ---
    // Safely log the incoming data without crashing on circular structures.
    console.log("Function triggered.");
    if (data) {
        console.log("Received data object with keys:", Object.keys(data));
        console.log("Value of data.opponentId:", data.opponentId);
    } else {
        console.log("Received no data object.");
    }
    // --- END OF NEW DEBUGGING CODE ---

    // Check for authentication
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "The function must be called while authenticated."
        );
    }

    const { opponentId } = data;

    // Validate opponentId
    if (!opponentId) {
        console.error("Validation failed: opponentId is missing or falsy.");
        throw new functions.https.HttpsError(
            "invalid-argument",
            "The function must be called with an 'opponentId'."
        );
    }

    try {
        // Get the opponent's push subscription from PocketBase
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
            // This is a valid case, not an error. The user just doesn't have notifications enabled.
            return { success: false, error: "No subscription found." };
        }
    } catch (error) {
        // This will now catch the error from PocketBase if the record is not found.
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