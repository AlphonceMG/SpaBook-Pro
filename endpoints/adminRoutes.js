import express from "express";
import Admin from "../models/Admin.js";
import { check, validationResult } from "express-validator";
import argon2 from "argon2";
import { v4 as uuid } from "uuid";

const router = express.Router();
// Admin Signup Routes

// Define the isAdmin function
async function isAdmin(req, res, next) {
	if (req.session.userUUID) {
		Admin.findOne({ uuid: req.session.userUUID })
			.then((user) => {
				if (user.role === "admin") {
					return next();
				}
				res.redirect("/");
			})
			.catch((error) => {
				console.error("Error checking admin role:", error);
				res.redirect("/");
			});
	} else {
		res.redirect("/login");
	}
}

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
		res.render("admin-signup");
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
			const hashedPassword = await argon2.hash(adminPassword); // Use argon2.hash directly
			const adminUUID = uuid.v4();

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
		// Check if the user accessing the login page is an admin
		if (req.session.userUUID) {
			const user = await Admin.findOne({ uuid: req.session.userUUID });
			if (user && user.role === "admin") {
				res.render("admin-login"); // Render the login page for admin users
			} else {
				res.redirect("/"); // Redirect non-admin users to the home page
			}
		} else {
			res.redirect("/"); // Redirect users who are not logged in to the home page
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

		if (user) {
			const passwordMatch = await argon2.verify(user.password, password);

			if (passwordMatch) {
				req.session.userUUID = user.uuid;
				if (user.role === "admin") {
					res.redirect("/admin/home");
				} else {
					res.redirect("/");
				}
			} else {
				res.redirect("/admin/login");
			}
		} else {
			res.redirect("/admin/login");
		}
	} catch (error) {
		console.error("Error logging in:", error);
		res.redirect("/admin/login");
	}
});

// Admin Home Page
router.get("/admin/home", isAdmin, async (req, res) => {
	try {
		// Fetch all services from the database
		const services = await Service.find({});
		res.render("admin-home", { services });
	} catch (error) {
		console.error("Error fetching services:", error);
		res.redirect("/admin/login");
	}
});

// Admin Services Page
router.get("/admin/services", isAdmin, async (req, res) => {
	try {
		const services = await Service.find();
		res.render("admin-services", { services });
	} catch (error) {
		console.error("Error fetching services:", error);
		req.flash("error", "Failed to fetch services.");
		res.redirect("/admin/home"); // Redirect to admin home or appropriate page
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
	const { name, description, price, time } = req.body;

	try {
		// Create a new service instance
		const newService = new Service({
			name,
			description,
			price,
			time,
		});

		// Save the service to the database
		await newService.save();

		// Flash a success message and redirect to the admin services page
		req.flash("success", "Service added successfully.");
		res.redirect("/admin/services");
	} catch (error) {
		console.error("Error adding a service:", error);
		req.flash("error", "Failed to add service.");
		res.redirect("/admin/addservice");
	}
});

// Delete Service routes using app.route
router.get("/admin/deleteservices", isAdmin, async (req, res) => {
	try {
		// Fetch all services from the database
		const services = await Service.find();
		res.render("admin-deleteservices", { services });
	} catch (error) {
		console.error("Error fetching services:", error);
		req.flash("error", "Failed to fetch services.");
		res.redirect("/admin/services"); // Redirect to the appropriate page on error
	}
});
router.post("/admin/deleteservices", isAdmin, async (req, res) => {
	const selectedServiceIds = req.body.selectedServices; // This will be an array of selected service IDs
	// Check if the user is authenticated and is an admin
	try {
		if (req.session.userUUID) {
			// Use the selectedServiceIds array to delete multiple services at once
			await Service.deleteMany({ _id: { $in: selectedServiceIds } });
			req.flash("success", "Selected services deleted successfully.");
			res.redirect("/admin/services"); // Redirect to the admin services page after deleting the services
		} else {
			res.redirect("/login"); // Redirect to the login page if not authenticated
		}
	} catch (error) {
		console.error("Error deleting services:", error);
		req.flash("error", "Failed to delete selected services.");
		res.redirect("/admin/services"); // Redirect back to the admin services page with an error message
	}
});

router.get("/admin/addstaff", async (req, res) => {
	try {
		// Check if the user accessing the add staff page is an admin
		if (req.session.userUUID) {
			const user = await Admin.findOne({ uuid: req.session.userUUID });

			if (user && user.role === "admin") {
				const messages = req.flash();
				res.render("admin-addstaff", { errors: [], messages });
			} else {
				res.redirect("/admin/home"); // Redirect non-admin users to the home page
			}
		} else {
			res.redirect("/"); // Redirect users who are not logged in to the home page
		}
	} catch (error) {
		console.error("Error checking admin role:", error);
		res.redirect("/");
	}
});

router.post("/admin/addstaff", async (req, res) => {
	try {
		// Check if the user accessing the add staff page is an admin
		if (req.session.userUUID) {
			const user = await Admin.findOne({ uuid: req.session.userUUID });

			if (user && user.role === "admin") {
				// Add checks and validation here
				if (
					!req.body.firstName ||
					!req.body.lastName ||
					!req.body.phoneNumber ||
					!req.body.speciality ||
					!req.body.gender ||
					!req.body.email ||
					!req.body.idNumber ||
					!req.body.nextOfKinIdNumber
				) {
					// If any of the required fields is missing, return an error
					req.flash("error", "All fields are required");
					return res.redirect("/admin/addstaff");
				}

				// Create a new staff member using the data from the form
				const newStaff = new Staff({
					firstName: req.body.firstName,
					lastName: req.body.lastName,
					phoneNumber: req.body.phoneNumber,
					speciality: req.body.speciality,
					gender: req.body.gender,
					email: req.body.email,
					idNumber: req.body.idNumber,
					nextOfKinIdNumber: req.body.nextOfKinIdNumber,
				});

				// Save the staff member to the database
				await newStaff.save();

				// Redirect to a success page or another appropriate route
				res.redirect("/admin/home"); // Customize the success route as needed
			} else {
				res.redirect("/"); // Redirect non-admin users to the home page
			}
		} else {
			res.redirect("/"); // Redirect users who are not logged in to the home page
		}
	} catch (error) {
		console.error("Error:", error.message);
		res.redirect("/");
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

console.log("POST request to /admin/signup received");

export { isAdmin };
export default router;