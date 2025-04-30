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
		// Don't clear selected services on page reload anymore
		if (!req.session.selectedServices) {
			req.session.selectedServices = [];
		}

		// Fetch bridal services from the database
		const bridalServices = await BridalService.find({});

		// Retrieve selected services from the session
		const selectedServiceNames = req.session.selectedServices.map(
			(service) => service.name
		);

		// Initialize bridalSelectedServices object
		const bridalSelectedServices = {};

		// Set the selection state for each bridal service
		for (const service of bridalServices) {
			bridalSelectedServices[service.name] = selectedServiceNames.includes(
				service.name
			);
		}

		console.log("Bridal Services:", bridalServices);
		console.log("Selected Services:", req.session.selectedServices);
		console.log("Selected Service Names:", selectedServiceNames);

		res.render("bridal-services", {
			bridalServices,
			selectedServiceNames,
			bridalSelectedServices,
		});
	} catch (error) {
		console.error("Error fetching bridal services:", error);
		res.status(500).send("Error fetching bridal services. Please try again later.");
	}
});

// Your POST route for selecting or deselecting a bridal service
router.post("/bridal/services/select-deselect/:action", async (req, res) => {
	const serviceName = req.body.bridalServiceName;
	const action = req.params.action;

	try {
		// Fetch the service details from the database
		const service = await BridalService.findOne({ name: serviceName });
		
		if (!service) {
			return res.status(404).json({ error: "Service not found" });
		}

		console.log("Database service:", {
			name: service.name,
			price: service.price,
			priceType: typeof service.price
		});

		// Initialize selectedServices if needed
		if (!req.session.selectedServices) {
			req.session.selectedServices = [];
		}

		if (action === "select") {
			// Add the service with its price
			const serviceToAdd = {
				name: service.name,
				price: Number(service.price) // Convert to number explicitly
			};
			console.log("Adding service:", serviceToAdd);
			req.session.selectedServices.push(serviceToAdd);
		} else if (action === "deselect") {
			// Remove the service
			req.session.selectedServices = req.session.selectedServices.filter(
				(s) => s.name !== serviceName
			);
		}

		// Save session explicitly
		req.session.save((err) => {
			if (err) {
				console.error("Error saving session:", err);
				return res.status(500).json({ error: "Error saving selection" });
			}

			console.log("Session services after update:", req.session.selectedServices);

			res.json({
				success: true,
				selected: action === "select",
				selectedServices: req.session.selectedServices
			});
		});
	} catch (error) {
		console.error("Error updating bridal service selection:", error);
		res.status(500).json({ error: "Error selecting services" });
	}
});

// Route for Bridal Registration
router.get("/bridal/registration", async (req, res) => {
	try {
		// Ensure session exists
		if (!req.session.selectedServices) {
			req.session.selectedServices = [];
		}

		console.log("Initial session services:", req.session.selectedServices);

		// Fetch fresh service data for selected services
		const updatedSelectedServices = await Promise.all(
			req.session.selectedServices.map(async (selectedService) => {
				const service = await BridalService.findOne({ name: selectedService.name });
				console.log("Found service from DB:", service);
				
				const updatedService = {
					name: selectedService.name,
					price: service ? Number(service.price) : 0
				};
				console.log("Updated service:", updatedService);
				return updatedService;
			})
		);

		// Calculate total deposit
		const totalDeposit = updatedSelectedServices.reduce((sum, service) => {
			console.log(`Adding to sum: ${service.name} - ${service.price}`);
			return sum + Number(service.price || 0);
		}, 0);

		console.log("Final services to render:", updatedSelectedServices);
		console.log("Final total deposit:", totalDeposit);

		res.render("bridal-registration", {
			registrationStatus: req.session.registrationStatus || '',
			bridalSelectedServices: updatedSelectedServices,
			totalDeposit: totalDeposit
		});
	} catch (error) {
		console.error("Error fetching bridal registration:", error);
		res.render("bridal-registration", {
			registrationStatus: "Error loading registration page",
			bridalSelectedServices: [],
			totalDeposit: 0
		});
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
