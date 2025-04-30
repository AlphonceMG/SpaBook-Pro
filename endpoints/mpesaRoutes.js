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

// Routes will be prefixed with /mpesa automatically by app.use('/mpesa', mpesaRoutes)

// GET /mpesa/payment
router.get("/payment", (req, res) => {
	try {
		// Get total deposit from session with fallback to 0
		const totalAmount = req.session?.totalDeposit || 0;
		const bookingIds = req.session?.bookingIds || [];

		// If accessing directly without session data, redirect to services
		if (totalAmount === 0) {
			return res.render("error", {
				message: "Please select services before proceeding to payment",
				error: {
					status: 400,
					stack: "No amount specified. Please start from the services selection page."
				}
			});
		}

		res.render("mpesa-payment", {
			totalAmount,
			bookingIds,
			error: req.session?.mpesaError || null
		});

		// Clear any error messages
		if (req.session) {
			delete req.session.mpesaError;
		}
	} catch (error) {
		console.error("Error rendering payment page:", error);
		res.status(500).render("error", { 
			message: "Failed to load payment page", 
			error 
		});
	}
});

// GET /mpesa/auth-token
router.get("/auth-token", mpesa.getOAuthToken);

// POST /mpesa/payment
router.post("/payment", mpesa.getOAuthToken, async (req, res) => {
	try {
		console.log('Received payment request:', {
			body: req.body,
			method: req.method,
			headers: req.headers['content-type']
		});

		// Extract amount from the request
		const { amount } = req.body;
		
		if (!amount) {
			console.log('Amount missing from request');
			return res.status(400).json({
				success: false,
				message: "Amount is required"
			});
		}

		console.log('Initiating payment with amount:', amount);

		// Call the function to initiate the M-Pesa payment
		const result = await mpesa.lipaNaMpesaOnline(req);
		console.log('Payment result:', result);

		// Check if the payment initiation was successful
		if (result && result.success) {
			// Store the IDs in session variables
			if (req.session && result.message) {
				req.session.merchantRequestId = result.message.MerchantRequestID;
				req.session.checkoutRequestId = result.message.CheckoutRequestID;
				req.session.responseCode = result.message.ResponseCode;
				req.session.responseDescription = result.message.ResponseDescription;
				req.session.customerMessage = result.message.CustomerMessage;
			}

			return res.json({
				success: true,
				message: "Payment initiated successfully",
				data: result.message
			});
		} else {
			console.log('Payment initiation failed:', result);
			return res.status(400).json({
				success: false,
				message: result?.message || "Payment initiation failed"
			});
		}
	} catch (error) {
		console.error("Payment initiation error:", error);
		return res.status(400).json({
			success: false,
			message: error.message || "Failed to process payment"
		});
	}
});

// POST /mpesa/callback
router.post("/callback", mpesa.lipaNaMpesaOnlineCallback);

// GET /mpesa/status
router.get("/status", mpesa.getOAuthToken, async (req, res) => {
	try {
		const merchantRequestId = req.session.merchantRequestId;
		const checkoutRequestId = req.session.checkoutRequestId;

		if (!checkoutRequestId) {
			return res.status(400).json({
				success: false,
				message: "No payment transaction in progress"
			});
		}

		const apiEndpoint = process.env.MPESA_TRANSACTION_STATUS_URL;
		const requestBody = {
			Initiator: process.env.MPESA_INITIATOR_NAME,
			SecurityCredential: process.env.MPESA_SECURITY_CREDENTIAL,
			CommandID: "TransactionStatusQuery",
			TransactionID: checkoutRequestId,
			OriginatorConversationID: merchantRequestId,
			PartyA: process.env.MPESA_SHORTCODE,
			IdentifierType: "4",
			ResultURL: `${process.env.BASE_URL}/mpesa/result`,
			QueueTimeOutURL: `${process.env.BASE_URL}/mpesa/timeout`,
			Remarks: "Payment status check",
			Occasion: "Payment"
		};

		const response = await axios.post(apiEndpoint, requestBody, {
			headers: {
				Authorization: `Bearer ${req.token}`
			}
		});

		if (response.data.ResponseCode === "0") {
			return res.json({
				success: true,
				data: response.data
			});
		} else {
			return res.json({
				success: false,
				message: response.data.ResponseDescription
			});
		}
	} catch (error) {
		console.error("Status check error:", error);
		return res.status(500).json({
			success: false,
			message: "Failed to check payment status"
		});
	}
});

// GET /mpesa/success/:mpesaReceiptNumber
router.get("/success/:mpesaReceiptNumber", (req, res) => {
	try {
		const { mpesaReceiptNumber } = req.params;
		res.render("mpesa-success", { 
			mpesaReceiptNumber,
			message: req.session.mpesaMessage || "Payment successful"
		});
	} catch (error) {
		console.error("Error displaying success page:", error);
		res.redirect("/mpesa/payment");
	}
});

// GET /mpesa/error
router.get("/error", (req, res) => {
	try {
		const errorMessage = req.query.message || "Payment processing failed";
		res.render("mpesa-error", { errorMessage });
	} catch (error) {
		console.error("Error displaying error page:", error);
		res.redirect("/mpesa/payment");
	}
});

export default router;
