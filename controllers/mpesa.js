import axios from "axios";
import { config } from "dotenv";

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

	async lipaNaMpesaOnline(req, res) {
		try {
			const token = req.token;
			const auth = `Bearer ${token}`;

			// Getting the timestamp
			const timestamp = require("../middleware/timestamp").timestamp;

			const url = process.env.lipa_na_mpesa_url;
			const bs_short_code = process.env.lipa_na_mpesa_shortcode;
			const passkey = process.env.lipa_na_mpesa_passkey;

			if (!bs_short_code || !passkey) {
				throw new Error("Business short code or passkey is missing.");
			}

			// You should validate other input fields here

			const password = Buffer.from(
				`${bs_short_code}${passkey}${timestamp}`
			).toString("base64");
			const transcation_type = "CustomerPayBillOnline";
			const amount = "1"; // You can enter any amount
			const partyA = process.env.party_a; // Should follow the format: 2547xxxxxxxx
			const partyB = process.env.lipa_na_mpesa_shortcode;
			const phoneNumber = process.env.party_a; // Should follow the format: 2547xxxxxxxx
			const callBackUrl = "https://sandbox.safaricom.co.ke/mpesa/"; // Replace with your actual callback URL
			const accountReference = "eddahs-spa";
			const transaction_desc = "Testing lipa na mpesa functionality";

			const stkPushRequest = {
				BusinessShortCode: bs_short_code,
				Password: password,
				Timestamp: timestamp,
				TransactionType: transcation_type,
				Amount: amount,
				PartyA: partyA,
				PartyB: partyB,
				PhoneNumber: phoneNumber,
				CallBackURL: callBackUrl,
				AccountReference: accountReference,
				TransactionDesc: transaction_desc,
			};

			const { data } = await axios.post(url, stkPushRequest, {
				headers: {
					Authorization: auth,
				},
			});

			// The response will contain details for creating the pop-up on the user's phone
			// You can extract and handle this data as needed

			return res.send({
				success: true,
				message: data,
			});
		} catch (err) {
			console.error("Error in lipaNaMpesaOnline:", err);

			// Send an error response here
			return res.status(500).send({
				success: false,
				message: "Failed to initiate M-Pesa payment.",
			});
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
				// Payment was successful, render the payment success page with the M-Pesa receipt number
				return res.render("payment-success", { mpesaReceiptNumber, message });
			} else {
				// Payment was not successful, render the payment error page with the error message
				return res.render("payment-error", { errorMessage: message });
			}
		} catch (err) {
			console.error("Error in lipaNaMpesaOnlineCallback:", err);
			return res.status(500).send({
				success: false,
				message: "Failed to process M-Pesa callback.",
			});
		}
	}
}

export default new MpesaController();
