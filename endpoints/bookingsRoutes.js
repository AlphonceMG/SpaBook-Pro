import express from "express";
import Service from "../models/Service.js";
import Staff from "../models/Staff.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";

const router = express.Router();

router.get("/bookings", async (req, res) => {
	try {
		// Fetch staff members data from your MongoDB database
		staffMembers = await Staff.find({}, "firstName lastName specialty");

		// Check if selected services are stored in the user's session
		const selectedServices = req.session.selectedServices || [];

		// Render the 'bookings.ejs' template and pass staff members and selected services
		res.render("bookings", { staff: staffMembers, selectedServices }); // Pass staffMembers here
	} catch (error) {
		console.error("Error fetching staff members:", error);
		res.status(500).json({ error: "Internal Server Error" });
	}
});
let services = [];
// Your GET route for rendering the services page
router.get("/bookings/services", async (req, res) => {
	try {
		// Fetch services data from your MongoDB database
		services = await Service.find({});
		// Create an object to organize services by categories
		const servicesByCategory = {};
		services.forEach((service) => {
			const { category } = service;
			if (!servicesByCategory[category]) {
				servicesByCategory[category] = [];
			}
			servicesByCategory[category].push(service);
		});

		// Fetch categories data from the database
		const categories = Object.keys(servicesByCategory);

		// Get the search term from the query parameter
		const searchTerm = req.query.search || "";

		// Render the 'bookings-services.ejs' template and pass the organized services, categories, searchTerm, and totalDeposit
		res.render("bookings-services", {
			services: servicesByCategory,
			categories,
			searchTerm,
		});
	} catch (error) {
		console.error("Error fetching services:", error);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

// Your POST route for selecting a service
router.post("/bookings/services/select", async (req, res) => {
	const serviceName = req.body.serviceName;
	try {
		const selectedService = await Service.findOne({ name: serviceName });
		if (selectedService) {
			selectedService.selected = true;
			await selectedService.save();
			// Update the services array with the updated selected service
			const updatedServices = services.map((service) =>
				service.name === serviceName ? selectedService : service
			);
			services = updatedServices;
			// Calculate the total deposit based on selected services
			const selectedServices = services.filter((service) => service.selected);
			const totalDeposit = calculateTotalDeposit(selectedServices);
			// Store selectedServices and totalDeposit in the session
			req.session.selectedServices = selectedServices;
			req.session.totalDeposit = totalDeposit;

			// Log the selectedServices and totalDeposit for debugging
			console.log("Selected Services:", selectedServices);
			console.log("Total Deposit:", totalDeposit);

			res.json({ success: true, totalDeposit, selected: true });
		} else {
			res.json({ success: false, error: "Service not found" });
		}
	} catch (error) {
		console.error("Error selecting service:", error);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

// Your POST route for deselecting a service
router.post("/bookings/services/deselect", async (req, res) => {
	const serviceName = req.body.serviceName;
	try {
		const deselectedService = await Service.findOne({ name: serviceName });
		if (deselectedService) {
			deselectedService.selected = false;
			await deselectedService.save();
			// Update the services array with the updated deselected service
			const updatedServices = services.map((service) =>
				service.name === serviceName ? deselectedService : service
			);
			services = updatedServices;
			// Calculate the total deposit based on selected services
			const selectedServices = services.filter((service) => service.selected);
			const totalDeposit = calculateTotalDeposit(selectedServices);
			// Store selectedServices and totalDeposit in the session
			req.session.selectedServices = selectedServices;
			req.session.totalDeposit = totalDeposit;

			// Log the selectedServices and totalDeposit for debugging
			console.log("Selected Services:", selectedServices);
			console.log("Total Deposit:", totalDeposit);

			res.json({ success: true, totalDeposit, selected: false });
		} else {
			res.json({ success: false, error: "Service not found" });
		}
	} catch (error) {
		console.error("Error deselecting service:", error);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

// Function to calculate the total deposit amount based on selected services
function calculateTotalDeposit(selectedServices) {
	let totalDeposit = 0;
	for (const service of selectedServices) {
		totalDeposit += 0.6 * parseFloat(service.price);
	}
	return totalDeposit;
}
router.get("/bookings/appointments", async (req, res) => {
	try {
		const services = await Service.find();
		const staff = await Staff.find();
		const selectedDateTime = new Date();

		// Access selected services from the session
		let selectedServices = req.session.selectedServices || [];

		// Define selectedService or retrieve it from the request body, query, or params
		const selectedService =
			req.body.selectedService ||
			req.query.selectedService ||
			req.params.selectedService;

		// Set default values for selectedDateTime, selectedService, and totalDeposit
		req.session.selectedDateTime = selectedDateTime;
		req.session.selectedService = selectedService;
		req.session.totalDeposit = req.session.totalDeposit || 0;

		// Update the session with the latest selected services
		if (selectedService) {
			const existingServiceIndex = selectedServices.findIndex(
				(service) => service.name === selectedService.name
			);
			if (existingServiceIndex === -1) {
				selectedServices.push(selectedService);
			} else {
				selectedServices[existingServiceIndex] = selectedService;
			}
			// Update the session with the modified selected services
			req.session.selectedServices = selectedServices;
			req.session.totalDeposit = calculateTotalDeposit(selectedServices);

			// Ensure that selectedSpecialist and selectedStaff are defined
			const storedSelectedStaff = req.session.selectedStaff || {};
			const selectedStaff = {
				firstName: storedSelectedStaff.name.split(" ")[0], // Modify based on your data structure
				lastName: storedSelectedStaff.name.split(" ")[1], // Modify based on your data structure
				...storedSelectedStaff,
			};

			req.session.selectedStaff = {
				id: selectedStaff.id,
				name: `${selectedStaff.firstName} ${selectedStaff.lastName}`,
				specialty: selectedStaff.specialty,
			};
		}

		// Log the session information to the console
		console.log(req.session);

		// Define the isStaffAvailable function here
		function isStaffAvailable(
			selectedStaff,
			selectedDateTime,
			selectedService = null
		) {
			// Check if selectedService is provided and not null
			if (selectedService) {
				const serviceTime = selectedService.time;
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
			} else {
				// Handle the case where selectedService is not provided
				// You can choose the appropriate behavior here
				return false; // For example, return false when no service is selected
			}
		}
		res.render("bookings-appointments", {
			services,
			staff,
			isStaffAvailable,
			selectedDateTime,
			selectedService,
			selectedServices: req.session.selectedServices,
			totalDeposit: req.session.totalDeposit, // Use the session value here
		});
	} catch (error) {
		console.error(error);
		res.status(500).send(`Internal Server Error: ${error.message}`);
	}
});
router.post("/bookings/appointments", async (req, res) => {
	const { staffId, service, selectedDateTime } = req.body;

	try {
		const selectedStaff = await Staff.findById(staffId);
		const selectedAppointmentStartTime = new Date(selectedDateTime);
		const selectedService = await Service.findOne({ name: service });
		const serviceTime = selectedService.time;
		const selectedAppointmentEndTime = new Date(
			selectedAppointmentStartTime.getTime() + serviceTime * 60000
		);

		const isAvailable = isStaffAvailable(
			selectedStaff,
			selectedDateTime,
			selectedService
		);

		if (isAvailable) {
			selectedStaff.appointments.push({
				datetime: selectedDateTime,
				service,
			});
			await selectedStaff.save();
			// Store selectedSpecialist in the session
			req.session.selectedSpecialist = {
				id: selectedStaff._id,
				name: `${selectedStaff.firstName} ${selectedStaff.lastName}`,
				specialty: selectedStaff.specialty,
			};
			res.send("Appointment booked successfully.");
		} else {
			res.send(
				"Staff member is not available at the selected time. Please choose another time or service."
			);
		}
	} catch (error) {
		console.error(error);
		res.status(500).send(`Internal Server Error: ${error.message}`);
	}
});
// New route for '/bookings/appointments/staff'
router.get("/bookings/appointments/staff", async (req, res) => {
	try {
		const specialty = req.query.specialty;
		let filteredStaff;

		if (specialty) {
			// If a specific service category is selected, filter staff by specialty
			filteredStaff = await Staff.find({ specialty: { $in: [specialty] } });
		} else {
			// If no specific service category is selected, return all staff
			filteredStaff = await Staff.find();
		}
		res.json(filteredStaff);
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "Internal Server Error" });
	}
});
// Define a route for the Booking registration form
router.get("/bookings/registration", async (req, res) => {
	try {
		// Get the booking status from the session (if available)
		const bookingStatus = req.session.bookingStatus || "";
		const selectedServices = req.session.selectedServices || [];
		const selectedDateTime = req.session.selectedDateTime || "";
		const totalDeposit = req.session.totalDeposit || 0;

		// Retrieve staff members from the database (modify this based on your database setup)
		const staffData = await Staff.find().exec();

		// Retrieve selectedSpecialist from the session
		const selectedStaff = req.session.selectedSpecialist || null;

		res.render("bookings-registration", {
			bookingStatus,
			staffData,
			selectedStaff,
			selectedServices,
			selectedDateTime,
			totalDeposit,
		});
	} catch (error) {
		console.error("Error retrieving staff members:", error);
		// Handle the error and redirect to an error page
		res.redirect("/bookings/services");
	}
});
router.post("/bookings/registration", async (req, res) => {
	try {
		// Retrieve session data
		const selectedServices = req.session.selectedServices || [];
		const selectedDateTime = req.session.selectedDateTime || "";
		const totalDeposit = req.session.totalDeposit || 0;
		const selectedStaff = req.session.selectedStaff || null;

		console.log("Selected Staff from session:", selectedStaff);

		const { firstName, lastName, phoneNumber, gender, email } = req.body;

		console.log("Received user registration data:");
		console.log("First Name:", firstName);
		console.log("Last Name:", lastName);
		console.log("Phone Number:", phoneNumber);
		console.log("Gender:", gender);
		console.log("Email:", email);

		// Check if a user with the same phone number already exists in the database
		const existingUser = await User.findOne({ phoneNumber });

		if (existingUser) {
			// Set the booking status in the session to indicate that a similar booking exists
			req.session.bookingStatus = "A similar booking already exists";
			res.redirect("/bookings/registration");
		} else {
			// Create a new user instance
			const newUser = new User({
				firstName,
				lastName,
				phoneNumber,
				gender,
				email,
			});

			// Save the user data to the database
			await newUser.save();

			// Retrieve service names based on ObjectIds
			const selectedServicesData = await Service.find({
				_id: { $in: selectedServices },
			});
			const selectedServiceNames = selectedServicesData.map(
				(service) => service.name
			);

			// Create a new booking instance
			const newBooking = new Booking({
				user: newUser._id,
				staffMember: selectedStaff,
				selectedServices,
				selectedDateTime,
				totalDeposit,
			});

			// Save the booking data to the database
			await newBooking.save();

			console.log("User registered successfully:");
			console.log(newUser);

			console.log("Booking saved successfully:");
			console.log(newBooking);

			// Set the booking status in the session to indicate a successful booking
			req.session.bookingStatus = "Successfully booked";

			res.redirect("/bookings/registration");
		}
	} catch (error) {
		console.error("Error registering user:", error);
		// Handle error and redirect to an error page
		res.redirect("/error");
	}
});

export default router;
