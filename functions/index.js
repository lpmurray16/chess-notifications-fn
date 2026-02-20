const functions = require("firebase-functions");
const admin = require("firebase-admin");
const PocketBase = require("pocketbase/cjs");

admin.initializeApp();

// Initialize PocketBase
const pb = new PocketBase("https://simple-chess-pb-backend.fly.dev");

exports.sendTurnNotification = functions.https.onCall(async (data, context) => {
    // --- START OF NEW DEBUGGING CODE ---
    // Log the entire incoming data object to see what we're receiving.
    console.log("Function triggered. Received data:", JSON.stringify(data, null, 2));
    // --- END OF NEW DEBUGGING CODE ---

    // Check for authentication
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "The function must be called while authenticated."
        );
    }

    const { opponentId } = data;

    // Log the extracted opponentId
    console.log("Extracted opponentId:", opponentId);


    // Validate opponentId
    if (!opponentId) {
        // Log an error before throwing
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

            // Construct the notification payload
            const payload = {
                notification: {
                    title: "Your Turn!",
                    body: "Your opponent has made their move.",
                    icon: "https://simple-chess-pb-backend.fly.dev/api/files/pbc_1863359460/b7u08j3303au1es/horse_icon_512_512_Gji32a61iR.png"
                }
            };

            // Send the notification
            await admin.messaging().sendToDevice(subscription.endpoint, payload);
            console.log("Successfully sent notification to opponent:", opponentId);
            return { success: true };

        } else {
            console.log("No push subscription found for opponent:", opponentId);
            return { success: false, error: "No subscription found." };
        }
    } catch (error) {
        console.error("Error sending notification:", error);
        if (error.response && error.response.data) {
            console.error("PocketBase error details:", error.response.data);
        }
        throw new functions.https.HttpsError(
            "internal",
            "Failed to send notification."
        );
    }
});