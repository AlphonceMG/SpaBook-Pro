import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
	user: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
	},
	service: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "Service",
	},
	status: {
		type: String,
		enum: ["pending", "confirmed", "completed", "canceled"],
		default: "pending",
	},
	notes: {
		type: String,
	},
	price: {
		type: Number,
	},
	deposit: {
		type: Number,
	},
	duration: {
		type: Number, // in minutes or hours
	},
	location: {
		type: String,
	},
	paymentStatus: {
		type: String,
		enum: ["paid", "unpaid", "partially paid"],
		default: "unpaid",
	},
	invoiceNumber: {
		type: String,
	},
	staffMember: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "Staff", // If a specific staff member is assigned
	},
	selectedServices: [
		// You might want to adjust the structure based on your Service model
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: "Service",
		},
	],
	selectedDateTime: {
		type: Date,
	},
	totalDeposit: {
		type: Number,
	},
	// Add more fields as needed
});

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;