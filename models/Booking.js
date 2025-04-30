import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
	user: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		required: true
	},
	staffMember: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "Staff",
		required: true
	},
	service: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "Service",
		required: true
	},
	selectedDateTime: {
		type: Date,
		required: true
	},
	totalDeposit: {
		type: Number,
		required: true
	},
	status: {
		type: String,
		enum: ['pending', 'confirmed', 'cancelled'],
		default: 'pending'
	},
	paymentStatus: {
		type: String,
		enum: ['unpaid', 'partially_paid', 'paid'],
		default: 'unpaid'
	},
	createdAt: {
		type: Date,
		default: Date.now
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
	invoiceNumber: {
		type: String,
	},
	selectedServices: [
		// You might want to adjust the structure based on your Service model
		{
			type: mongoose.Schema.Types.ObjectId,
			ref: "Service",
		},
	],
	// Add more fields as needed
});

// Add indexes for better query performance
bookingSchema.index({ user: 1, selectedDateTime: 1 });
bookingSchema.index({ staffMember: 1, selectedDateTime: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ paymentStatus: 1 });

const Booking = mongoose.model("Booking", bookingSchema);

export default Booking;