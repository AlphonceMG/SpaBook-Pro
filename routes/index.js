import express from "express";
import bodyParser from "body-parser";
import { config } from "dotenv";
import path from "path";
import mpesa from "../controllers/mpesa.js";


config();

const app = express();
const router = express.Router();

app.use(bodyParser.urlencoded({ extended: true }));
// app.use(express.static(path.join(__dirname, "public")));

router.get("/lipa-na-mpesa", (req, res) => {
	res.render("lipa-na-mpesa"); // Assuming your EJS file is named 'lipa-na-mpesa.ejs'
});

// Route to get the auth token
router.get("/get-auth-token", mpesa.getOAuthToken);

// Lipa na M-Pesa online
router.post("/lipa-na-mpesa", mpesa.getOAuthToken, async (req, res) => {
	try {
		// Extract form data from the request
		const phone = req.body.phone;
		const paybill = req.body.paybill;

		// Call the function to initiate the M-Pesa payment
		const result = await mpesa.lipaNaMpesaOnline(req, res); // Pass the `res` object here

		// Check if the payment initiation was successful
		if (result.success) {
			// Clear existing session variables
			req.session.merchantRequestId = null;
			req.session.checkoutRequestId = null;
			req.session.checkoutRequestId = null;
			req.session.checkoutRequestId = null;
			req.session.checkoutRequestId = null;

			// Store the IDs in session variables
			req.session.merchantRequestId = result.message.MerchantRequestID;
			req.session.checkoutRequestId = result.message.CheckoutRequestID;
			req.session.checkoutRequestId = result.message.ResponseCode;
			req.session.checkoutRequestId = result.message.ResponseDescription;
			req.session.checkoutRequestId = result.message.CustomerMessage;
		} else {
			// Payment initiation failed, you can handle errors accordingly
			return res.send(`Payment initiation failed: ${result.message}`);
		}
	} catch (error) {
		// Handle any unexpected errors
		console.error(error);
		return res.status(500).send("Internal Server Error");
	}
});

// Callback URL
router.post("/lipa-na-mpesa-callback", mpesa.lipaNaMpesaOnlineCallback);

router.get("/mpesa/payment-status", mpesa.getOAuthToken, async (req, res) => {
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
			"Transaction ID": "checkoutRequestId", // Use CheckoutRequestID as Transaction ID
			OriginatorConversationID: "merchantRequestId", // Use MerchantRequestID as OriginatorConversationID
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
				// Payment was successful, render the payment success page
				return res.render("payment-success", {
					mpesaReceiptNumber: apiResponse.CheckoutRequestID,
				});
			} else {
				// Payment was not successful, render the payment error page with the error message
				return res.render("payment-error", {
					errorMessage: apiResponse.ResponseDescription,
				});
			}
		} else {
			// Handle API call error
			console.error("API call failed with status:", response.status);
			return res.status(500).send("Internal Server Error");
		}
	} catch (error) {
		// Handle any other errors that may occur during the status check
		console.error(error);
		return res.status(500).send("Internal Server Error");
	}
});

router.get("/payment-success/:mpesaReceiptNumber", (req, res) => {
	const mpesaReceiptNumber = req.params.mpesaReceiptNumber;
	res.render("payment-success", { mpesaReceiptNumber });
});
router.get("/payment-error", (req, res) => {
	const errorMessage = req.query.errorMessage; // You can pass the error message as a query parameter
	res.render("payment-error", { errorMessage });
});

export default router;
