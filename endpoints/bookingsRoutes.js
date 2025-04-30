import express from "express";
import Service from "../models/Service.js";
import Staff from "../models/Staff.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import { logger } from "../utils/logger.js";

const router = express.Router();

// Helper function to calculate the total deposit amount
function calculateTotalDeposit(selectedServices) {
	return selectedServices.reduce((total, service) => total + (service.price * 0.5), 0);
}

// Helper function to check staff availability
function isStaffAvailable(selectedStaff, selectedDateTime, selectedService) {
	if (!selectedStaff || !selectedDateTime) {
		return false;
	}

	const serviceTime = selectedService?.time || 60; // Default to 60 minutes
				const selectedAppointmentStartTime = new Date(selectedDateTime);
				const selectedAppointmentEndTime = new Date(
					selectedAppointmentStartTime.getTime() + serviceTime * 60000
				);

				// Check if the selected staff has any conflicting appointments
				return !selectedStaff.appointments.some((appointment) => {
					const appointmentStartTime = new Date(appointment.datetime);
					const appointmentEndTime = new Date(
						appointmentStartTime.getTime() + serviceTime * 60000
					);
					return (
						(selectedAppointmentStartTime >= appointmentStartTime &&
							selectedAppointmentStartTime < appointmentEndTime) ||
						(selectedAppointmentEndTime > appointmentStartTime &&
							selectedAppointmentEndTime <= appointmentEndTime)
					);
				});
}

// Initial bookings page
router.get("/bookings", async (req, res) => {
	try {
		const staffMembers = await Staff.find({}, "firstName lastName specialty");
		const selectedServices = req.session.selectedServices || [];

		res.render("bookings", { 
			staff: staffMembers, 
			selectedServices,
			error: req.session.bookingError
		});
		
		// Clear any error messages
		delete req.session.bookingError;
	} catch (error) {
		console.error("Error in bookings route:", error);
		res.status(500).render("error", { 
			message: "Failed to load booking page", 
			error 
		});
	}
});

// Services selection page
router.get("/bookings/services", async (req, res) => {
	try {
		logger.bookingProcess("User started service selection process", {
			sessionId: req.sessionID
		});

		// Initialize session variables if they don't exist
		if (!req.session.selectedServices) {
			req.session.selectedServices = [];
		}
		if (typeof req.session.totalDeposit === 'undefined') {
			req.session.totalDeposit = 0;
		}

		const services = await Service.find({}).lean();
		if (!services || services.length === 0) {
			logger.error("No services found in database");
			throw new Error("No services available");
		}

		const servicesByCategory = {};
		const categoryServiceSets = {};

		// Organize services by category, ensuring uniqueness
		services.forEach((service) => {
			const { category, name } = service;
			
			// Initialize category arrays and sets if they don't exist
			if (!servicesByCategory[category]) {
				servicesByCategory[category] = [];
				categoryServiceSets[category] = new Set();
			}

			// Only add the service if it's not already in this category
			if (!categoryServiceSets[category].has(name)) {
				categoryServiceSets[category].add(name);
				servicesByCategory[category].push(service);
			}
		});

		const categories = Object.keys(servicesByCategory);
		
		logger.bookingProcess("Services loaded successfully", {
			categoriesCount: categories.length,
			totalServices: services.length,
			selectedServices: req.session.selectedServices.length
		});

		res.render("bookings-services", {
			services: servicesByCategory,
			categories,
			selectedServices: req.session.selectedServices,
			totalDeposit: req.session.totalDeposit,
			error: req.session.serviceError
		});

		// Clear any error messages after rendering
		delete req.session.serviceError;
	} catch (error) {
		logger.error("Error in services page", error);
		
		// Set a user-friendly error message
		req.session.serviceError = "Unable to load services. Please try again later.";
		
		// Redirect to main bookings page with error
		return res.redirect("/bookings");
	}
});

// Service selection route
router.post('/bookings/services/select', async (req, res) => {
	try {
		const { serviceName } = req.body;
		logger.bookingProcess("Service selection attempt", {
			serviceName,
			sessionId: req.sessionID
		});

		if (!serviceName) {
			logger.error("Missing service name in selection request");
			return res.status(400).json({ 
				success: false, 
				message: 'Service name is required' 
			});
		}

		// Initialize selected services array if it doesn't exist
		if (!req.session.selectedServices) {
			req.session.selectedServices = [];
		}

		// Check if service is already selected
		if (req.session.selectedServices.some(s => s.name === serviceName)) {
			logger.bookingProcess("Service already selected", { serviceName });
			return res.status(400).json({ 
				success: false, 
				message: 'Service is already selected' 
			});
		}

		// Find the service in the database
		const service = await Service.findOne({ name: serviceName });
		if (!service) {
			logger.error("Service not found", { serviceName });
			return res.status(404).json({ 
				success: false, 
				message: 'Service not found' 
			});
		}

		// Add service to selected services
		const serviceData = {
			name: service.name,
			price: service.price,
			time: service.time,
			category: service.category
		};
		req.session.selectedServices.push(serviceData);

		// Calculate new total deposit
		const totalDeposit = calculateTotalDeposit(req.session.selectedServices);
		req.session.totalDeposit = totalDeposit;

		logger.bookingProcess("Service selected successfully", {
			serviceName,
			totalDeposit,
			selectedServicesCount: req.session.selectedServices.length
		});

		res.json({
			success: true,
			totalDeposit,
			message: 'Service selected successfully'
		});
	} catch (error) {
		logger.error("Error selecting service", error);
		res.status(500).json({ 
			success: false, 
			message: 'Failed to select service' 
		});
	}
});

// Service deselection route
router.post('/bookings/services/deselect', async (req, res) => {
	try {
		const { serviceName } = req.body;
		logger.bookingProcess("Service deselection attempt", {
			serviceName,
			sessionId: req.sessionID
		});

		if (!serviceName) {
			logger.error("Missing service name in deselection request");
			return res.status(400).json({ 
				success: false, 
				message: 'Service name is required' 
			});
		}

		// Check if selected services exists
		if (!req.session.selectedServices) {
			logger.error("No services selected in session");
			return res.status(400).json({ 
				success: false, 
				message: 'No services are selected' 
			});
		}

		// Remove service from selected services
		const initialCount = req.session.selectedServices.length;
		req.session.selectedServices = req.session.selectedServices.filter(s => s.name !== serviceName);
		
		if (initialCount === req.session.selectedServices.length) {
			logger.error("Service not found in selected services", { serviceName });
			return res.status(400).json({ 
				success: false, 
				message: 'Service was not selected' 
			});
		}

		// Calculate new total deposit
		const totalDeposit = calculateTotalDeposit(req.session.selectedServices);
		req.session.totalDeposit = totalDeposit;

		logger.bookingProcess("Service deselected successfully", {
			serviceName,
			totalDeposit,
			selectedServicesCount: req.session.selectedServices.length
		});

		res.json({
			success: true,
			deselected: true,
			totalDeposit,
			message: 'Service deselected successfully'
		});
	} catch (error) {
		logger.error("Error deselecting service", error);
		res.status(500).json({ 
			success: false, 
			message: 'Failed to deselect service' 
		});
	}
});

// Route to get selected services
router.get('/bookings/services/selected', async (req, res) => {
	try {
		if (!req.session.selectedServices) {
			req.session.selectedServices = [];
		}

		const totalDeposit = calculateTotalDeposit(req.session.selectedServices);

		res.json({
			success: true,
			selectedServices: req.session.selectedServices,
			totalDeposit
		});
	} catch (error) {
		console.error('Error fetching selected services:', error);
		res.status(500).json({ 
			success: false, 
			message: 'Failed to fetch selected services' 
		});
	}
});

// Appointments page
router.get("/bookings/appointments", async (req, res) => {
	try {
		logger.bookingProcess("User accessing appointments page", {
			sessionId: req.sessionID,
			selectedServices: req.session.selectedServices?.length || 0
		});

		if (!req.session.selectedServices || req.session.selectedServices.length === 0) {
			logger.bookingProcess("No services selected, redirecting to services page");
			req.session.bookingError = "Please select at least one service first";
			return res.redirect("/bookings/services");
		}

		const services = await Service.find();
		const staff = await Staff.find().populate('appointments');

		logger.bookingProcess("Appointments page loaded", {
			availableStaff: staff.length,
			selectedServices: req.session.selectedServices
		});

		res.render("bookings-appointments", {
			services,
			staff,
			isStaffAvailable,
			selectedDateTime: new Date(),
			selectedServices: req.session.selectedServices,
			totalDeposit: req.session.totalDeposit || 0,
			error: req.session.appointmentError
		});

		// Clear any error messages
		delete req.session.appointmentError;
	} catch (error) {
		logger.error("Error in appointments page", error);
		res.status(500).render("error", { 
			message: "Failed to load appointments page", 
			error 
		});
	}
});

// Handle appointment booking
router.post("/bookings/appointments", async (req, res) => {
	try {
		const { appointments } = req.body;
		logger.bookingProcess("Appointment booking attempt", {
			appointmentsCount: appointments?.length || 0,
			sessionId: req.sessionID
		});

		if (!appointments || !Array.isArray(appointments)) {
			logger.error("Invalid appointment data received");
			return res.status(400).json({
				success: false,
				error: "Invalid appointment data"
			});
		}

		// Validate all appointments
		const validatedAppointments = [];
		for (const appointment of appointments) {
			const { staffId, serviceName, selectedDateTime } = appointment;

			if (!staffId || !serviceName || !selectedDateTime) {
				logger.error("Missing appointment information", appointment);
				return res.status(400).json({
					success: false,
					error: "Missing required booking information"
				});
			}

			const selectedStaff = await Staff.findById(staffId);
			if (!selectedStaff) {
				logger.error("Staff not found", { staffId });
				return res.status(404).json({
					success: false,
					error: "Staff member not found"
				});
			}

			const selectedService = await Service.findOne({ name: serviceName });
			if (!selectedService) {
				logger.error("Service not found", { serviceName });
				return res.status(404).json({
					success: false,
					error: "Service not found"
				});
			}

			// Check availability without accessing appointments directly
			const appointmentDate = new Date(selectedDateTime);
			const existingAppointments = await Staff.findOne({
				_id: staffId,
				'appointments.dateTime': {
					$gte: new Date(appointmentDate.getTime() - (selectedService.time * 60000)),
					$lt: new Date(appointmentDate.getTime() + (selectedService.time * 60000))
				}
			});

			if (existingAppointments) {
				logger.error("Staff not available", {
					staff: selectedStaff.firstName,
					dateTime: selectedDateTime
				});
				return res.status(400).json({
					success: false,
					error: `Staff member ${selectedStaff.firstName} is not available at the selected time`
				});
			}

			validatedAppointments.push({
				staff: {
					id: selectedStaff._id,
					name: `${selectedStaff.firstName} ${selectedStaff.lastName}`,
					specialty: selectedStaff.specialty
				},
				service: {
					id: selectedService._id,
					name: selectedService.name,
					price: selectedService.price,
					time: selectedService.time,
					category: selectedService.category
				},
				selectedDateTime: appointmentDate
			});
		}

		// Store appointments in session for later use
		req.session.appointments = validatedAppointments;
		logger.bookingProcess("Appointments validated successfully", {
			appointmentsCount: validatedAppointments.length
		});

		// Create appointments one by one
		for (const appointment of validatedAppointments) {
			const selectedStaff = await Staff.findById(appointment.staff.id);
			
			// Add new appointment without validation
			await Staff.findByIdAndUpdate(
				appointment.staff.id,
				{
					$push: {
						appointments: {
							dateTime: appointment.selectedDateTime,
							service: appointment.service.id
						}
					}
				},
				{ new: true }
			);

			logger.bookingProcess("Appointment saved successfully", {
				staffId: selectedStaff._id,
				appointmentTime: appointment.selectedDateTime
			});
		}

		res.json({
			success: true,
			message: "Appointments booked successfully",
			redirectUrl: "/bookings/registration"
		});
	} catch (error) {
		logger.error("Error booking appointments", error);
		res.status(500).json({
			success: false,
			error: error.message || "Failed to book appointments"
		});
	}
});

// Get available staff by specialty
router.get("/bookings/appointments/staff", async (req, res) => {
	try {
		const { specialty } = req.query;
		const query = specialty ? { specialty: { $in: [specialty] } } : {};
		
		const staff = await Staff.find(query)
			.select('firstName lastName specialty appointments')
			.populate('appointments');

		res.json(staff);
	} catch (error) {
		console.error("Error fetching staff:", error);
		res.status(500).json({ error: "Failed to fetch staff members" });
	}
});

// Registration form page
router.get("/bookings/registration", async (req, res) => {
	try {
		logger.bookingProcess("User accessing registration page", {
			sessionId: req.sessionID,
			appointmentsCount: req.session.appointments?.length || 0
		});

		if (!req.session.appointments || !req.session.selectedServices) {
			logger.bookingProcess("Incomplete booking process, redirecting to bookings");
			req.session.bookingError = "Please complete service and appointment selection first";
			return res.redirect("/bookings");
		}

		res.render("bookings-registration", {
			bookingStatus: req.session.bookingStatus || "",
			appointments: req.session.appointments,
			selectedServices: req.session.selectedServices,
			totalDeposit: req.session.totalDeposit || 0,
			error: req.session.registrationError
		});

		delete req.session.registrationError;
	} catch (error) {
		logger.error("Error in registration page", error);
		res.status(500).render("error", { 
			message: "Failed to load registration page", 
			error 
		});
	}
});

// Handle registration submission
router.post("/bookings/registration", async (req, res) => {
	try {
		const { firstName, lastName, gender, email } = req.body;
		// Always use the development phone number with proper format
		const phoneNumber = "+254793004830";

		if (!firstName || !lastName || !gender) {
			logger.error("Missing registration fields", {
				firstName: !!firstName,
				lastName: !!lastName,
				gender: !!gender
			});
			req.session.registrationError = "Please fill in all required fields";
			return res.redirect("/bookings/registration");
		}

		// Check if user exists with development phone number
		let user = await User.findOne({ phoneNumber });
		if (!user) {
			user = new User({
				firstName: firstName.trim(),
				lastName: lastName.trim(),
				phoneNumber,
				gender,
				email: email ? email.toLowerCase().trim() : undefined
			});
			await user.save();
			logger.bookingProcess("New user created", { userId: user._id });
		}

		// Create bookings using session appointments
		if (!req.session.appointments || !Array.isArray(req.session.appointments)) {
			logger.error("No appointments found in session");
			req.session.registrationError = "No appointments found. Please start booking process again.";
			return res.redirect("/bookings");
		}

		const bookings = [];
		for (const appointment of req.session.appointments) {
			const booking = new Booking({
				user: user._id,
				staffMember: appointment.staff.id,
				service: appointment.service.id,
				selectedDateTime: appointment.selectedDateTime,
				totalDeposit: (appointment.service.price * 0.6),
				status: 'pending',
				paymentStatus: 'unpaid'
			});
			await booking.save();
			bookings.push(booking);
		}

		// Store booking information in session
		req.session.bookingIds = bookings.map(booking => booking._id);
		req.session.totalDeposit = req.session.totalDeposit;
		req.session.bookingStatus = "Successfully booked";

		logger.bookingProcess("Bookings created, redirecting to payment", {
			userId: user._id,
			bookingIds: req.session.bookingIds,
			totalDeposit: req.session.totalDeposit
		});

		res.redirect("/mpesa/payment");
	} catch (error) {
		logger.error("Error in registration process", error);
		req.session.registrationError = "Failed to process registration";
		res.redirect("/bookings/registration");
	}
});

export default router;
