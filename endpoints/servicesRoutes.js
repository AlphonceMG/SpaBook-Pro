import express from "express";
import Service from "../models/Service.js";

const router = express.Router();
// Define a route for displaying services
router.get("/services", async (req, res) => {
	try {
		// Fetch all services from the database
		const services = await Service.find({});
		if (!services) {
			// Handle the case where no services are found
			req.flash("error", "No services found.");
			res.redirect("/"); // Redirect to the appropriate page
			return;
		}

		// Render the services.ejs template and pass the services object
		res.render("services", { services });
	} catch (error) {
		console.error("Error fetching services:", error);
		req.flash("error", "Failed to fetch services.");
		res.redirect("/"); // Redirect to the appropriate page on error
	}
});

export default router;
