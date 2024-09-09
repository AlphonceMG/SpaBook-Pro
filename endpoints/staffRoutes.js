import express from "express";
import Staff from "../models/Staff.js";
import Admin from "../models/Admin.js";

import { isAdmin } from "./adminRoutes.js";

const router = express.Router();

router.get("/staff/registration", async (req, res) => {
	res.render("staff-registration");
});
router.post("/staff/registration", isAdmin, async (req, res) => {
	try {
		const {
			firstName,
			lastName,
			phoneNumber,
			gender,
			email,
			idNumber,
			nextOfKinIdNumber,
			speciality,
		} = req.body;

		// Validation checks
		if (!/^\+254[17]\d{8}$/.test(phoneNumber)) {
			return res.status(400).send("Invalid phone number format");
		}

		if (!/^\w+@\w+\.\w+$/.test(email)) {
			return res.status(400).send("Invalid email address format");
		}

		if (!/^\d{8}$/.test(idNumber)) {
			return res.status(400).send("Invalid ID number format");
		}

		// Create a new staff instance
		const newStaff = new StaffModel({
			firstName,
			lastName,
			phoneNumber,
			gender,
			email,
			idNumber,
			nextOfKinIdNumber,
			speciality,
		});

		// Save the staff to the database using async/await
		const savedStaff = await newStaff.save();

		res.status(201).json(savedStaff);
	} catch (error) {
		console.error(error);
		res.status(500).send("Internal Server Error");
	}
});

router.get("/staff", async (req, res) => {
	try {
		const staffMembers = await Staff.find({}, "firstName lastName specialty");

		res.render("staff", { staffMembers });
	} catch (error) {
		console.error("Error fetching staff members:", error);
		res.redirect("/");
	}
});
export default router;
