import express from "express";
import bodyParser from "body-parser";
import ejs from "ejs";
import mongoose from "mongoose";
import session from "express-session";
import MongoStore from "connect-mongo";
import flash from "flash";
import path from "path";
import { config } from "dotenv";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import mpesa from "./routes/index.js";
import Staff from "./models/Staff.js";
import Admin from "./models/Admin.js";
import BridalBooking from "./models/BridalBooking.js";
import BridalService from "./models/BridalServices.js";
import Log from "./models/Log.js";
import Service from "./models/Service.js";
import User from "./models/User.js";
import Booking from "./models/Booking.js"
import adminRoutes from "./endpoints/adminRoutes.js";
import bookingRoutes from "./endpoints/bookingsRoutes.js";
import bridalRoutes from "./endpoints/bridalRoutes.js";
import servicesRoutes from "./endpoints/servicesRoutes.js";
import staffRoutes from "./endpoints/staffRoutes.js";

config();

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

//app configurations
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Create a new MongoDB connection and use it for the session store
const sessionStore = MongoStore.create({
	mongoUrl: "mongodb://127.0.0.1:27017/eddahsDB", // Adjust this URL to your MongoDB configuration
});

// Session configuration with session expiration
app.use(
	session({
		secret: process.env.SECRET_KEY,
		resave: false,
		saveUninitialized: true,
		store: sessionStore,
		cookie: {
			// Session expiration time (15 minutes)
			maxAge: 15 * 60 * 1000, // milliseconds
		},
	})
);

app.use(flash());
app.set("view engine", "ejs");


mongoose
	.connect("mongodb://127.0.0.1:27017/eddahsDB")
	.then(() => {
		console.log("MongoDB connected successfully");
	})
	.catch((err) => {
		console.error("MongoDB connection error:", err);
	});

// Define a middleware function to log user actions
async function logUserJourney(req, res, next) {
	// Check if the session has expired
	if (req.session && req.session.userJourney) {
		// Log the current user action or store it in the session
		const userAction = req.originalUrl;
		req.session.userJourney.push(userAction);

		// Capture additional information
		const ipAddress = req.ip; // Capture user's IP address
		const useragent = req.get("User-Agent"); // Capture user agent
		const sessionID = req.sessionID; // Capture session ID
		const httpMethod = req.method; // Capture HTTP method
		const requestBody = req.body; // Capture request body or parameters
		const responseStatus = res.statusCode; // Capture response status code
		const referrer = req.get("Referrer"); // Capture referrer
		const userLocation =
			req.headers["x-forwarded-for"] || req.connection.remoteAddress; // Capture user location
		const userRole = req.session.userRole || ""; // Capture user role if available
		const userID = req.session.userUUID || ""; // Capture user ID if available
		const actionDescription = ""; // Add your own description for the action

		let firstName = "";
		let lastName = "";

		// Determine the source of names based on the user's action
		if (userAction === "/bookings-registration") {
			// Get first and last names from the User registration
			const user = await User.findOne({ _id: userID });
			if (user) {
				firstName = user.firstName;
				lastName = user.lastName;
			}
		} else if (userAction === "/bridal-registration") {
			// Get first and last names from the Bridal registration
			const bridalBooking = await BridalBooking.findOne({ _id: userID });
			if (bridalBooking) {
				firstName = bridalBooking.firstName;
				lastName = bridalBooking.lastName;
			}
		} else if (userAction === "/staff-registration") {
			// Get first and last names from the Staff registration
			const staff = await Staff.findOne({ _id: userID });
			if (staff) {
				firstName = staff.firstName;
				lastName = staff.lastName;
			}
		}
		try {
			// Create a new log entry and save it to the database
			const logEntry = new Log({
				firstName,
				lastName,
				userUUID: userID,
				action: userAction,
				ipAddress,
				useragent,
				sessionID,
				httpMethod,
				requestBody,
				responseStatus,
				referrer,
				userLocation,
				userRole,
				actionDescription,
			});

			// Log the data before saving it
			console.log("Log Entry Data:", logEntry);

			await logEntry.save();
		} catch (err) {
			console.error("Error logging user action:", err);
		}
	} else {
		// Session has expired or is not available, log session exit time
		if (req.session && req.session.sessionEntryTime) {
			// Log the session exit time
			const exitTime = new Date();
			const entryTime = req.session.sessionEntryTime;
			const sessionDuration = exitTime - entryTime;

			// Log the session exit time and duration
			try {
				const sessionExitLog = new Log({
					sessionID: req.sessionID,
					action: "Session Exit",
					sessionExitTime: exitTime,
					sessionDuration: sessionDuration,
				});

				await sessionExitLog.save();
			} catch (err) {
				console.error("Error logging session exit time:", err);
			}
		}
	}
	next();
}

// Use the user journey logging middleware for all routes
app.use(logUserJourney);

// Middleware to track session entry time
app.use((req, res, next) => {
	if (req.session) {
		req.session.sessionEntryTime = new Date();
	}
	next();
});

app.get("/", (req, res) => {
	res.render("home");
});

app.use(adminRoutes);
app.use(staffRoutes);
app.use(servicesRoutes);
app.use(bookingRoutes);
app.use(bridalRoutes);

// mpesa routes
// const mpesa = require("./routes/index.js");
app.use("/mpesa", mpesa);

// Error handling middleware
app.use((err, req, res, next) => {
	console.error(err.stack);
	res.status(500).send("Something went wrong!");
});

// 'purgeLogs' function and schedule it to run
const purgeLogs = async () => {
	try {
		// Calculate the date that's 30 days ago
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		// Delete logs older than 30 days
		await Log.deleteMany({ timestamp: { $lt: thirtyDaysAgo } });

		console.log("Log entries older than 30 days have been purged.");
	} catch (error) {
		console.error("Error purging old logs:", error);
	}
};

// Schedule log purging every 24 hours (adjust the interval as needed)
setInterval(purgeLogs, 24 * 60 * 60 * 1000);

export default app;


