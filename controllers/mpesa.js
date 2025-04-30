import axios from "axios";
import { config } from "dotenv";
import { getTimestamp } from "../middleware/timestamp.js";

config();

class MpesaController {
	async getOAuthToken(req, res, next) {
		try {
			console.log("Fetching OAuth token...");

			const consumer_key = process.env.consumer_key;
			const consumer_secret = process.env.consumer_secret;

			if (!consumer_key || !consumer_secret) {
				throw new Error("Consumer key or secret is missing.");
			}

			const url = process.env.oauth_token_url;

			// Form a buffer of the consumer key and secret
			const buffer = Buffer.from(`${consumer_key}:${consumer_secret}`);

			const auth = `Basic ${buffer.toString("base64")}`;

			const { data } = await axios.get(url, {
				headers: {
					Authorization: auth,
				},
			});

			req.token = data["access_token"];

			console.log("OAuth token obtained:", req.token);
			return next();
		} catch (err) {
			console.error(err);
			return res.status(500).send({
				success: false,
				message: "Failed to obtain OAuth token.",
			});
		}
	}

	async lipaNaMpesaOnline(req) {
		try {
			console.log('Starting MPesa payment process');
			
			const token = req.token;
			if (!token) {
				throw new Error('OAuth token is missing');
			}

			const auth = `Bearer ${token}`;
			console.log('Using auth token:', token);

			// Getting the timestamp
			const timestamp = getTimestamp();
			console.log('Generated timestamp:', timestamp);

			const url = process.env.lipa_na_mpesa_url;
			const bs_short_code = process.env.lipa_na_mpesa_shortcode;
			const passkey = process.env.lipa_na_mpesa_passkey;
			const testPhoneNumber = process.env.party_a;

			console.log('Checking MPesa configuration:', {
				url: !!url,
				bs_short_code: !!bs_short_code,
				passkey: !!passkey,
				testPhoneNumber: !!testPhoneNumber,
				actualPhone: testPhoneNumber
			});

			if (!bs_short_code || !passkey) {
				throw new Error("Business short code or passkey is missing.");
			}

			if (!testPhoneNumber) {
				throw new Error("Test phone number (party_a) is missing from configuration.");
			}

			if (!url) {
				throw new Error("MPesa API URL is missing from configuration.");
			}

			// Get amount from request body
			const { amount } = req.body;
			if (!amount) {
				throw new Error("Amount is required");
			}

			const password = Buffer.from(
				`${bs_short_code}${passkey}${timestamp}`
			).toString("base64");
			
			// Format the phone number to ensure it's correct
			const formattedPhone = testPhoneNumber.toString().replace('+', '').replace(/^0/, '254');
			
			const stkPushRequest = {
				BusinessShortCode: bs_short_code,
				Password: password,
				Timestamp: timestamp,
				TransactionType: "CustomerPayBillOnline",
				Amount: amount.toString(),
				PartyA: formattedPhone,
				PartyB: bs_short_code,
				PhoneNumber: formattedPhone,
				CallBackURL: process.env.result_url || "https://sandbox.safaricom.co.ke/mpesa/",
				AccountReference: "eddahs-spa",
				TransactionDesc: "Eddah's Spa Payment"
			};

			console.log('Sending STK Push Request:', JSON.stringify(stkPushRequest, null, 2));

			const { data } = await axios.post(url, stkPushRequest, {
				headers: {
					Authorization: auth,
					'Content-Type': 'application/json'
				},
			});

			console.log('MPesa API Response:', data);

			return {
				success: true,
				message: data
			};
		} catch (err) {
			console.error("Error in lipaNaMpesaOnline:", {
				message: err.message,
				response: err.response?.data,
				stack: err.stack
			});
			
			throw new Error(err.response?.data?.errorMessage || err.message || "Failed to initiate M-Pesa payment");
		}
	}
	lipaNaMpesaOnlineCallback(req, res) {
		try {
			// Get the M-Pesa receipt number
			const mpesaReceiptNumber = req.body.Body.stkCallback[
				"CallbackMetadata"
			].Item.find((item) => item.Name === "MpesaReceiptNumber").Value;

			// Get the transaction description
			const message = req.body.Body.stkCallback["ResultDesc"];

			// Get CallbackMetadata if it exists
			const callbackMetadata = req.body.Body.stkCallback["CallbackMetadata"];

			// You can handle the callback data here as needed, including CallbackMetadata
			if (callbackMetadata) {
				const items = callbackMetadata.Item;

				// Extract and handle individual items from CallbackMetadata
				const amount = items.find((item) => item.Name === "Amount").Value;
				const mpesaReceiptNumber = items.find(
					(item) => item.Name === "MpesaReceiptNumber"
				).Value;
				const transactionDate = items.find(
					(item) => item.Name === "TransactionDate"
				).Value;
				const phoneNumber = items.find(
					(item) => item.Name === "PhoneNumber"
				).Value;

				// You can log or process these values as needed
				console.log("Amount:", amount);
				console.log("M-Pesa Receipt Number:", mpesaReceiptNumber);
				console.log("Transaction Date:", transactionDate);
				console.log("Phone Number:", phoneNumber);
			}

			// Check if the payment was successful based on your criteria (e.g., ResponseCode)
			const responseCode = req.body.Body.stkCallback["ResultCode"];

			if (responseCode === "0") {
				// Payment was successful
				return res.render("mpesa-success", { mpesaReceiptNumber, message });
			} else {
				// Payment was not successful
				return res.render("mpesa-error", { errorMessage: message });
			}
		} catch (error) {
			console.error("Error in lipaNaMpesaOnlineCallback:", error);
			return res.status(500).send({
				success: false,
				message: "Failed to process M-Pesa callback.",
			});
		}
	}
}

export default new MpesaController();
