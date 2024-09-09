import mongoose from "mongoose";

const staffSchema = new mongoose.Schema({
	firstName: String,
	lastName: String,
	phoneNumber: String,
	specialty: String,
	gender: String, // Add the gender field
	email: String, // Add the email field
	idNumber: String, // Add the ID number field
	bookingDate: Date,
	nextOfKinIdNumber: String, // Add the Next of Kin ID number field
	role: {
		type: String,
		enum: ["staff"],
		default: "staff",
	},
	appointments: [
		{
			dateTime: Date, // Store the appointment date and time as a Date object
		},
	],
});

const Staff = mongoose.model("Staff", staffSchema);

export default Staff;
