import express from "express";
import bodyParser from "body-parser";
import { config } from "dotenv";
import path from "path";
import mpesa from "../controllers/mpesa.js";
import axios from 'axios';


config();

const app = express();
const router = express.Router();

app.use(bodyParser.urlencoded({ extended: true }));
// app.use(express.static(path.join(__dirname, "public")));

router.get("/mpesa/payment", (req, res) => {
	res.render("mpesa-payment");
});

// Get auth token
router.get("/mpesa/auth-token", mpesa.getOAuthToken);

// Initiate M-Pesa payment
router.post("/mpesa/payment", mpesa.getOAuthToken, async (req, res) => {
	try {
		// Extract form data from the request
		const phone = req.body.phone;
		const paybill = req.body.paybill;

		// Call the function to initiate the M-Pesa payment
		const result = await mpesa.lipaNaMpesaOnline(req, res);

		// Check if the payment initiation was successful
		if (result.success) {
			// Clear existing session variables
			req.session.merchantRequestId = null;
			req.session.checkoutRequestId = null;

			// Store the IDs in session variables
			req.session.merchantRequestId = result.message.MerchantRequestID;
			req.session.checkoutRequestId = result.message.CheckoutRequestID;
			req.session.responseCode = result.message.ResponseCode;
			req.session.responseDescription = result.message.ResponseDescription;
			req.session.customerMessage = result.message.CustomerMessage;
		} else {
			// Payment initiation failed
			return res.send(`Payment initiation failed: ${result.message}`);
		}
	} catch (error) {
		console.error(error);
		return res.status(500).send("Internal Server Error");
	}
});

// M-Pesa callback URL
router.post("/mpesa/callback", mpesa.lipaNaMpesaOnlineCallback);

// Check payment status
router.get("/mpesa/status", mpesa.getOAuthToken, async (req, res) => {
	try {
		// Retrieve the stored MerchantRequestID and CheckoutRequestID from session
		const merchantRequestId = req.session.merchantRequestId;
		const checkoutRequestId = req.session.checkoutRequestId;

		// Construct the API endpoint for checking payment status
		const apiEndpoint = process.env.transaction_status;

		// Set up the request body for checking the payment status
		const requestBody = {
			Initiator: "eddas-spa",
			SecurityCredential: process.env.SECURITY_CREDENTIAL,
			"Command ID": "TransactionStatusQuery",
			"Transaction ID": checkoutRequestId,
			OriginatorConversationID: merchantRequestId,
			PartyA: process.env.party_a,
			IdentifierType: process.env.lipa_na_mpesa_shortcode,
			ResultURL: process.env.result_url,
			QueueTimeOutURL: process.env.timeout_url,
			Remarks: "OK",
			Occasion: "OK",
		};

		// Make an API call to the M-Pesa server to check payment status
		const response = await axios.post(apiEndpoint, requestBody);

		// Log the request and response for debugging
		console.log("M-Pesa Transaction Status Request:", requestBody);
		console.log("M-Pesa Transaction Status Response:", response.data);

		// Check if the API call was successful
		if (response.status === 200) {
			// Parse the API response JSON
			const apiResponse = response.data;

			// Check the payment status based on the API response
			if (apiResponse.ResponseCode === "0") {
				// Payment was successful
				return res.redirect(`/mpesa/success/${apiResponse.CheckoutRequestID}`);
			} else {
				// Payment was not successful
				return res.redirect(`/mpesa/error?message=${apiResponse.ResponseDescription}`);
			}
		} else {
			// Handle API call error
			console.error("API call failed with status:", response.status);
			return res.status(500).send("Internal Server Error");
		}
	} catch (error) {
		console.error(error);
		return res.status(500).send("Internal Server Error");
	}
});

// Payment success page
router.get("/mpesa/success/:mpesaReceiptNumber", (req, res) => {
	const mpesaReceiptNumber = req.params.mpesaReceiptNumber;
	res.render("mpesa-success", { mpesaReceiptNumber });
});

// Payment error page
router.get("/mpesa/error", (req, res) => {
	const errorMessage = req.query.message;
	res.render("mpesa-error", { errorMessage });
});

export default router;
