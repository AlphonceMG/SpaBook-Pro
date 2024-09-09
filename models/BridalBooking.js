import mongoose from "mongoose";
const bridalBookingSchema = new mongoose.Schema({
	firstName: {
		type: String,
		required: true,
	},
	lastName: {
		type: String,
		required: true,
	},
	emailAddress: {
		type: String,
		required: true,
	},
	phoneNumber: {
		type: String,
		required: true,
	},
	brideMaids: {
		type: [String],
		required: true,
	},
	weddingDate: {
		type: Date,
		required: true,
	},
	weddingLocation: {
		type: String,
		required: true,
	},
});

const BridalBooking = mongoose.model("BridalBooking", bridalBookingSchema);

export default BridalBooking;