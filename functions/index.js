// functions/index.js

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const PocketBase = require('pocketbase/cjs');
const { defineString } = require('firebase-functions/params');

// Initialize Firebase Admin SDK
admin.initializeApp();

// --- New Parameterized Configuration ---
// Define the parameters that your function needs.
// Firebase will automatically load these from a .env file during deployment.
const pocketbaseUrl = defineString('POCKETBASE_URL');
const pocketbaseAdminEmail = defineString('POCKETBASE_ADMIN_EMAIL');
const pocketbaseAdminPassword = defineString('POCKETBASE_ADMIN_PASSWORD');
const appUrl = defineString('APP_URL', { description: 'The public URL of your web app.' });

/**
 * A callable Cloud Function that sends a push notification to an opponent.
 */
exports.sendTurnNotification = functions.https.onCall(async (data) => {
	const opponentId = data.opponentId;

	if (!opponentId) {
		throw new functions.https.HttpsError('invalid-argument', "The function must be called with an 'opponentId'.");
	}

	functions.logger.log(`Attempting to send notification to opponent: ${opponentId}`);

	try {
		// --- PocketBase Integration ---
		// Use the .value() method to get the parameter values at runtime
		const pb = new PocketBase(pocketbaseUrl.value());
		await pb.admins.authWithPassword(pocketbaseAdminEmail.value(), pocketbaseAdminPassword.value());
		functions.logger.log('Successfully authenticated with PocketBase.');

		// Find the push subscription for the opponent
		const record = await pb.collection('push_subscriptions').getFirstListItem(`user = "${opponentId}"`);
		functions.logger.log('Fetched subscription record for user.');

		if (record && record.subscription) {
			const pushSubscription = record.subscription;

			// The FCM registration token is the last part of the endpoint URL
			const fcmToken = pushSubscription.endpoint.split('/').pop();

			// --- Firebase Cloud Messaging (FCM) ---
			// Construct the notification message
			const message = {
				token: fcmToken,
				notification: {
					title: 'Your Move!',
					body: "It's your turn to make a move in your chess game.",
				},
				webpush: {
					notification: {
						// Use a full, public URL for the icon
						icon: `${appUrl.value()}/assets/icons/icon-192x192.png`,
					},
					fcm_options: {
						// This link is opened when the user clicks the notification
						link: `${appUrl.value()}/play`,
					},
				},
			};

			functions.logger.log('Sending notification with payload:', message);
			await admin.messaging().send(message);

			functions.logger.log('Successfully sent notification.');
			return { success: true, message: 'Notification sent.' };
		} else {
			throw new functions.https.HttpsError('not-found', `Subscription not found for user: ${opponentId}`);
		}
	} catch (error) {
		functions.logger.error('Error sending notification:', error);
		throw new functions.https.HttpsError('internal', 'Failed to send notification.');
	}
});
