import express from "express";
import Admin from "../models/Admin.js";
import Service from "../models/Service.js";
import Staff from "../models/Staff.js";
import { check, validationResult } from "express-validator";
import argon2 from "argon2";
import { v4 as uuidv4 } from "uuid";
import Booking from "../models/Booking.js";

const router = express.Router();
// Admin Signup Routes

// Define the isAdmin function
const isAdmin = async (req, res, next) => {
	if (req.session.userUUID) {
		try {
			const user = await Admin.findOne({ uuid: req.session.userUUID });
			if (user && user.role === "admin") {
				return next();
			}
			req.flash("error", "Access denied. Admin privileges required.");
			res.redirect("/admin/login");
		} catch (error) {
			console.error("Error checking admin role:", error);
			req.flash("error", "Authentication error");
			res.redirect("/admin/login");
		}
	} else {
		req.flash("error", "Please login to continue");
		res.redirect("/admin/login");
	}
};

const validateAdminCredentials = [
	check("adminEmail")
		.notEmpty()
		.withMessage("Email address is required")
		.isEmail()
		.withMessage("Invalid email address")
		.normalizeEmail(),
	check("adminPassword")
		.notEmpty()
		.withMessage("Password is required")
		.isLength({ min: 8 })
		.withMessage("Password must be at least 8 characters long")
		.matches(/^(?=.*[!@#$%^&*])/)
		.withMessage("Password must contain at least one special character"),
	check("confirmPassword").custom((value, { req }) => {
		if (!req.body.adminPassword || value !== req.body.adminPassword) {
			throw new Error("Passwords do not match");
		}
		return true;
	}),
];

router.get("/admin/signup", async (req, res) => {
	try {
		const messages = req.flash();
		res.render("admin-signup", { messages });
	} catch (error) {
		console.error("Error rendering admin-signup:", error.message);
		res.status(500).send("An error occurred while rendering the page.");
	}
});
router.post("/admin/signup", validateAdminCredentials, async (req, res) => {
	try {
		console.log("POST request to /admin/signup received");
		console.log("Form Data:", req.body);
		const errors = validationResult(req);

		if (!errors.isEmpty()) {
			console.error("Validation errors:", errors.array());
			const messages = req.flash();
			return res.render("admin-signup", {
				errors: errors.array(),
				messages,
			});
		}

		const { adminEmail, adminPassword } = req.body;
		const adminCount = await Admin.countDocuments({ role: "admin" });

		if (adminCount === 0) {
			const hashedPassword = await argon2.hash(adminPassword);
			const adminUUID = uuidv4();

			const newAdmin = new Admin({
				uuid: adminUUID,
				email: adminEmail,
				password: hashedPassword,
				role: "admin",
			});

			await newAdmin.save();

			req.session.userUUID = adminUUID;
			req.flash("success", "Registration successful!");
			res.redirect("/admin/home");
		} else {
			req.flash("error", "Admin account already exists.");
			res.redirect("/admin/signup");
		}
	} catch (error) {
		console.error("Error:", error.message);
		req.flash("error", "Registration failed.");
		res.redirect("/admin/signup"); // Redirect back to the signup page
	}
});

// Login Routes

router.get("/admin/login", async (req, res) => {
	try {
		const messages = req.flash();
		// Check if the user accessing the login page is an admin
		if (req.session.userUUID) {
			const user = await Admin.findOne({ uuid: req.session.userUUID });
			if (user && user.role === "admin") {
				res.redirect("/admin/home"); // Redirect to home if already logged in
			} else {
				res.render("admin-login", { messages }); // Render login with messages
			}
		} else {
			res.render("admin-login", { messages }); // Render login with messages
		}
	} catch (error) {
		console.error("Error:", error.message);
		req.flash("error", "Login Failed.");
		res.redirect("/admin/signup");
	}
});

router.post("/admin/login", async (req, res) => {
	const { email, password } = req.body;

	try {
		const user = await Admin.findOne({ email });

		if (!user) {
			req.flash("error", "Invalid email or password");
			return res.redirect("/admin/login");
		}

		const passwordMatch = await argon2.verify(user.password, password);

		if (passwordMatch) {
			req.session.userUUID = user.uuid;
			if (user.role === "admin") {
				req.flash("success", "Login successful!");
				res.redirect("/admin/home");
			} else {
				req.flash("error", "Access denied. Admin privileges required.");
				res.redirect("/admin/login");
			}
		} else {
			req.flash("error", "Invalid email or password");
			res.redirect("/admin/login");
		}
	} catch (error) {
		console.error("Error logging in:", error);
		req.flash("error", "An error occurred during login");
		res.redirect("/admin/login");
	}
});

// Admin Home Page
router.get("/admin/home", isAdmin, async (req, res) => {
	try {
		console.log("Fetching services for admin home...");
		
		// Get count of unique services
		const uniqueServicesCount = await Service.aggregate([
			{
				$group: {
					_id: "$name"
				}
			},
			{
				$count: "total"
			}
		]);
		
		const totalServices = uniqueServicesCount[0]?.total || 0;
		console.log(`Total unique services: ${totalServices}`);
		
		// Get recent unique services
		const services = await Service.aggregate([
			// Group by name to get unique services
			{
				$group: {
					_id: "$name",
					id: { $first: "$_id" },
					name: { $first: "$name" },
					description: { $first: "$description" },
					price: { $first: "$price" },
					time: { $first: "$time" },
					category: { $first: "$category" },
					createdAt: { $first: "$_id" }  // Using _id for sorting as it contains timestamp
				}
			},
			// Sort by most recent first
			{ $sort: { createdAt: -1 } },
			// Limit to 5 services
			{ $limit: 5 },
			// Project to match the expected format
			{
				$project: {
					_id: "$id",
					name: 1,
					description: 1,
					price: 1,
					time: 1,
					category: 1
				}
			}
		]);

		console.log(`Recent unique services found: ${services.length}`);

		const messages = req.flash();
		res.render("admin-home", { 
			services,
			totalServices,
			messages 
		});
	} catch (error) {
		console.error("Error in admin home route:", error);
		req.flash("error", "Error loading admin dashboard");
		res.redirect("/admin/login");
	}
});

// Admin Services Page
router.get("/admin/services", isAdmin, async (req, res) => {
	try {
		// Simple find query to get all services
		const services = await Service.find()
			.sort({ name: 1 })
			.select('name description price time category')
			.lean();

		console.log(`Found ${services.length} services in the database`);

		const messages = req.flash();
		res.render("admin-services", { 
			services: services,
			messages 
		});
	} catch (error) {
		console.error("Error fetching services:", error);
		req.flash("error", "Failed to fetch services.");
		res.redirect("/admin/home");
	}
});

// Add route to handle merging duplicate services
router.post("/admin/services/merge", isAdmin, async (req, res) => {
	try {
		const { primaryServiceId, duplicateIds } = req.body;

		if (!primaryServiceId || !duplicateIds || !Array.isArray(duplicateIds)) {
			req.flash("error", "Invalid request format");
			return res.redirect("/admin/services");
		}

		// Get the primary service
		const primaryService = await Service.findById(primaryServiceId);
		if (!primaryService) {
			req.flash("error", "Primary service not found");
			return res.redirect("/admin/services");
		}

		// Update any bookings or references that use the duplicate services
		// to use the primary service instead
		await Booking.updateMany(
			{ serviceId: { $in: duplicateIds } },
			{ $set: { serviceId: primaryServiceId } }
		);

		// Delete the duplicate services
		await Service.deleteMany({ _id: { $in: duplicateIds } });

		req.flash("success", "Services merged successfully");
		res.redirect("/admin/services");
	} catch (error) {
		console.error("Error merging services:", error);
		req.flash("error", "Failed to merge services");
		res.redirect("/admin/services");
	}
});

// Define a route for adding services

router.get("/admin/addservice", isAdmin, async (req, res) => {
	try {
		// Render the add-service form when a GET request is made
		res.render("admin-addservice");
	} catch (error) {
		console.error("Error:", error.message);
		req.flash("error", "Error fetching admin addservice.");
		res.redirect("/admin/home");
	}
});
router.post("/admin/addservice", isAdmin, async (req, res) => {
	// Handle the form submission to add a new service when a POST request is made
	const { name, description, price, time, category } = req.body;

	try {
		// Validate required fields
		if (!name || !description || !price || !time || !category) {
			req.flash("error", "All fields are required, including category");
			return res.redirect("/admin/addservice");
		}

		// Create a new service instance
		const newService = new Service({
			name,
			description,
			price,
			time,
			category
		});

		// Check if service with same name already exists
		const existingService = await Service.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
		if (existingService) {
			req.flash("error", "A service with this name already exists");
			return res.redirect("/admin/addservice");
		}

		// Save the service to the database
		await newService.save();
		console.log("New service added:", newService);

		// Flash a success message and redirect to the admin services page
		req.flash("success", "Service added successfully.");
		res.redirect("/admin/services");
	} catch (error) {
		console.error("Error adding a service:", error);
		req.flash("error", "Failed to add service.");
		res.redirect("/admin/addservice");
	}
});

// Edit Service Routes
router.get("/admin/editservice/:id", isAdmin, async (req, res) => {
	try {
		const service = await Service.findById(req.params.id);
		if (!service) {
			req.flash("error", "Service not found");
			return res.redirect("/admin/services");
		}
		const messages = req.flash();
		res.render("admin-editservice", { service, messages });
	} catch (error) {
		console.error("Error fetching service:", error);
		req.flash("error", "Failed to fetch service details");
		res.redirect("/admin/services");
	}
});

router.post("/admin/editservice/:id", isAdmin, async (req, res) => {
	try {
		const { name, description, price, time } = req.body;
		const serviceId = req.params.id;

		// Validate inputs
		if (!name || !description || !price || !time) {
			req.flash("error", "All fields are required");
			return res.redirect(`/admin/editservice/${serviceId}`);
		}

		// Check if service exists
		const service = await Service.findById(serviceId);
		if (!service) {
			req.flash("error", "Service not found");
			return res.redirect("/admin/services");
		}

		// Update service
		await Service.findByIdAndUpdate(serviceId, {
			name,
			description,
			price: Number(price),
			time: Number(time)
		});

		req.flash("success", "Service updated successfully");
		res.redirect("/admin/services");
	} catch (error) {
		console.error("Error updating service:", error);
		req.flash("error", "Failed to update service");
		res.redirect(`/admin/editservice/${req.params.id}`);
	}
});

// Update the delete services route to handle both single and multiple deletions
router.post("/admin/deleteservices", isAdmin, async (req, res) => {
	const selectedServiceIds = Array.isArray(req.body.selectedServices) 
		? req.body.selectedServices 
		: [req.body.selectedServices];

	try {
		if (!selectedServiceIds || selectedServiceIds.length === 0) {
			req.flash("error", "No services selected for deletion");
			return res.redirect("/admin/services");
		}

		await Service.deleteMany({ _id: { $in: selectedServiceIds } });
		
		const count = selectedServiceIds.length;
		const message = count === 1 
			? "Service deleted successfully" 
			: `${count} services deleted successfully`;
		
		req.flash("success", message);
		res.redirect("/admin/services");
	} catch (error) {
		console.error("Error deleting services:", error);
		req.flash("error", "Failed to delete services");
		res.redirect("/admin/services");
	}
});

router.get("/admin/addstaff", isAdmin, async (req, res) => {
	try {
		const messages = req.flash();
		res.render("admin-addstaff", { messages });
	} catch (error) {
		console.error("Error:", error.message);
		req.flash("error", "Failed to load add staff page");
		res.redirect("/admin/home");
	}
});

router.post("/admin/addstaff", isAdmin, async (req, res) => {
	try {
		const {
			firstName,
			lastName,
			phoneNumber,
			specialty,
			gender,
			email,
			idNumber,
			nextOfKinIdNumber
		} = req.body;

		// Validate required fields
		if (!firstName || !lastName || !phoneNumber || !specialty || !gender || !email || !idNumber || !nextOfKinIdNumber) {
			req.flash("error", "All fields are required");
			return res.redirect("/admin/addstaff");
		}

		// Create a new staff member
		const newStaff = new Staff({
			firstName: firstName.trim(),
			lastName: lastName.trim(),
			phoneNumber,
			specialty,
			gender,
			email: email.toLowerCase(),
			idNumber,
			nextOfKinIdNumber,
			role: "staff",
			appointments: []
		});

		// Save the staff member
		await newStaff.save();

		req.flash("success", `Staff member ${firstName} ${lastName} added successfully`);
		res.redirect("/admin/home");
	} catch (error) {
		console.error("Error adding staff member:", error);
		
		// Handle specific validation errors
		if (error.code === 11000) {
			// Duplicate key error
			const field = Object.keys(error.keyPattern)[0];
			req.flash("error", `A staff member with this ${field} already exists`);
		} else if (error.name === "ValidationError") {
			// Mongoose validation error
			const messages = Object.values(error.errors).map(err => err.message);
			req.flash("error", messages.join(". "));
		} else {
			req.flash("error", "Failed to add staff member. Please try again.");
		}
		
		res.redirect("/admin/addstaff");
	}
});

router.get("/admin/userjourney", isAdmin, async (req, res) => {
	try {
		// Fetch user journey data from the Log model (assuming you have a UserJourneyStatistics model)
		const userJourneyData = await Log.find({});

		// Create an object to pass data to your EJS template
		const data = userJourneyData.map((logEntry) => ({
			firstName: logEntry.firstName,
			lastName: logEntry.lastName,
			timestamp: logEntry.timestamp,
			action: logEntry.action,
			ipAddress: logEntry.ipAddress,
			useragent: logEntry.useragent,
			userID: logEntry.userID,
			actionDescription: logEntry.actionDescription,
		}));

		// Render your EJS template and pass the data
		res.render("admin-userjourney", { data });
	} catch (error) {
		console.error("Error fetching user journey data:", error);
		res.status(500).json({ error: "Internal Server Error" });
	}
});

// Route to check for duplicate services
router.get("/admin/checkduplicates", isAdmin, async (req, res) => {
	try {
		const services = await Service.find({}).sort({ name: 1 });
		const duplicates = [];
		const seen = new Map();

		services.forEach(service => {
			const normalizedName = service.name.toLowerCase().trim();
			if (seen.has(normalizedName)) {
				duplicates.push({
					original: seen.get(normalizedName),
					duplicate: service
				});
			} else {
				seen.set(normalizedName, service);
			}
		});

		res.render("admin-duplicates", { 
			services, 
			duplicates,
			messages: req.flash()
		});
	} catch (error) {
		console.error("Error checking duplicates:", error);
		req.flash("error", "Failed to check for duplicates");
		res.redirect("/admin/services");
	}
});

// Route to merge duplicate services
router.post("/admin/mergeduplicates", isAdmin, async (req, res) => {
	try {
		const { keepId, deleteId } = req.body;
		
		if (!keepId || !deleteId) {
			req.flash("error", "Invalid request");
			return res.redirect("/admin/checkduplicates");
		}

		// Delete the duplicate service
		await Service.findByIdAndDelete(deleteId);
		
		req.flash("success", "Duplicate service merged successfully");
		res.redirect("/admin/services");
	} catch (error) {
		console.error("Error merging duplicates:", error);
		req.flash("error", "Failed to merge duplicates");
		res.redirect("/admin/checkduplicates");
	}
});

// Admin Delete Staff Routes
router.get("/admin/deletestaff", isAdmin, async (req, res) => {
	try {
		// Fetch all staff members
		const staffMembers = await Staff.find({}).sort({ firstName: 1 });
		const messages = req.flash();
		res.render("admin-deletestaff", { staffMembers, messages });
	} catch (error) {
		console.error("Error fetching staff members:", error);
		req.flash("error", "Failed to fetch staff members");
		res.redirect("/admin/home");
	}
});

router.post("/admin/deletestaff", isAdmin, async (req, res) => {
	try {
		const { staffIds } = req.body;
		
		if (!staffIds || (Array.isArray(staffIds) && staffIds.length === 0)) {
			req.flash("error", "No staff members selected for deletion");
			return res.redirect("/admin/deletestaff");
		}

		const idsToDelete = Array.isArray(staffIds) ? staffIds : [staffIds];

		// Delete the selected staff members
		await Staff.deleteMany({ _id: { $in: idsToDelete } });

		// Update any bookings that reference the deleted staff members
		await Booking.updateMany(
			{ staffMember: { $in: idsToDelete } },
			{ $unset: { staffMember: "" } }
		);

		const count = idsToDelete.length;
		const message = count === 1 
			? "Staff member deleted successfully" 
			: `${count} staff members deleted successfully`;

		req.flash("success", message);
		res.redirect("/admin/deletestaff");
	} catch (error) {
		console.error("Error deleting staff members:", error);
		req.flash("error", "Failed to delete staff members");
		res.redirect("/admin/deletestaff");
	}
});

console.log("POST request to /admin/signup received");

export { isAdmin };
export default router;