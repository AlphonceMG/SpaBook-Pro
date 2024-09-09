import express from "express";
import BridalBooking from "../models/BridalBooking.js";
import BridalService from "../models/BridalServices.js";

import { check, validationResult } from "express-validator";
import { v4 as uuid } from "uuid";

const router = express.Router();

const validate = [
	check("emailAddress").isEmail().withMessage("Invalid email address"),
	check("phoneNumber")
		.isMobilePhone("any", { strictMode: false })
		.withMessage("Invalid phone number"),
	check("weddingDate").isISO8601().withMessage("Invalid wedding date"),
];

// Your GET route for rendering the Bridal Services page
router.get("/bridal/services", async (req, res) => {
	try {
		// Check if it's a page reload (GET request) or moving to the next page (POST request)
		if (req.method === "GET") {
			// Clear selected services from the session on page reload
			req.session.selectedServices = [];
		}

		// Fetch bridal services from the database
		const bridalServices = await BridalService.find({});

		// Retrieve selected services from the session or initialize an empty array
		const selectedServiceNames = (req.session.selectedServices || []).map(
			(service) => service.name
		);

		// Initialize bridalSelectedServices object
		const bridalSelectedServices = {};

		// Set the selection state for each bridal service based on the selectedServiceNames array
		for (const service of bridalServices) {
			bridalSelectedServices[service.name] = selectedServiceNames.includes(
				service.name
			);
		}

		console.log("Bridal Services:", bridalServices);
		console.log("Selected Service Names:", selectedServiceNames);
		console.log("Bridal Selected Services:", bridalSelectedServices);

		res.render("bridal-services", {
			bridalServices,
			selectedServiceNames,
			bridalSelectedServices,
		});
	} catch (error) {
		console.error("Error fetching bridal services:", error);
		res
			.status(500)
			.send("Error fetching bridal services. Please try again later.");
	}
});

// Your POST route for selecting or deselecting a bridal service
router.post("/bridal/services/select-deselect/:action", async (req, res) => {
	const serviceName = req.body.bridalServiceName;
	const action = req.params.action;

	try {
		if (action === "select") {
			// Update the session to include the selected service
			req.session.selectedServices = [
				...(req.session.selectedServices || []),
				{ name: serviceName },
			];
		} else if (action === "deselect") {
			// Update the session to remove the deselected service
			req.session.selectedServices = (
				req.session.selectedServices || []
			).filter((service) => service.name !== serviceName);
		}

		console.log("Action:", action);
		console.log("Service Name:", serviceName);
		console.log("Updated Selected Services:", req.session.selectedServices);

		res.json({ success: true, selected: action === "select" });
	} catch (error) {
		console.error("Error updating bridal service selection:", error);
		res.status(500).json({ error: "Error selecting services" });
	}
});

// Route for Bridal Registration
router.get("/bridal/registration", async (req, res) => {
	try {
		// Render the Bridal registration form
		res.render("bridal-registration", {
			registrationStatus: req.session.registrationStatus,
		});
	} catch (error) {
		console.error("Error fetching bridal registration");
		res.status(500).send("Error fetching bridal registration");
	}
});
router.post("/bridal/registration", validate, async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			console.error("Validation errors:", errors.array());
			// Handle validation errors and render the form with error messages
			return res.render("bridal-registration", { errors: errors.array() });
		}

		const {
			firstName,
			lastName,
			emailAddress,
			phoneNumber,
			brideMaids,
			weddingDate,
			weddingLocation,
		} = req.body;

		// Check if a similar bridal registration already exists
		const existingBridalBooking = await BridalBooking.findOne({
			phoneNumber,
			weddingDate,
		});

		if (existingBridalBooking) {
			req.session.registrationStatus =
				"A similar bridal registration already exists";
		} else {
			// Generate a unique UUID for the registering person
			const userUUID = uuid.v4();

			// Create a new BridalBooking instance with the specific fields and the generated UUID
			const bridalBooking = new BridalBooking({
				uuid: userUUID,
				firstName,
				lastName,
				emailAddress,
				phoneNumber,
				brideMaids,
				weddingDate,
				weddingLocation,
			});

			// Save the Bridal registration details to the database
			await bridalBooking.save();

			req.session.registrationStatus = "Bridal registration successful!";
		}

		// Redirect back to the Bridal registration page
		res.redirect("/bridal/registration");
	} catch (error) {
		console.error("Error registering Bridal:", error);
		req.session.registrationStatus = "Bridal registration failed.";
		res.redirect("/bridal/registration"); // Redirect back to the Bridal form with an error message
	}
});

export default router;
