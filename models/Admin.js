import mongoose from "mongoose";

// Define schemas for 'admin', 'user', 'staff', 'service', and 'booking'
const adminSchema = new mongoose.Schema({
	name: String,
	email: String,
	uuid: String,
	password: String,
	role: {
		type: String,
		enum: ["admin", "staff"],
		default: "admin",
	},
	appointments: [
		{
			time: String, // Store the appointment time as a string (e.g., "10:00 am")
		},
	],
});

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;