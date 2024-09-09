import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
	firstName: {
		type: String,
		required: true,
	},
	lastName: {
		type: String,
		required: true,
	},
	phoneNumber: {
		type: String,
		required: true,
	},
	gender: {
		type: String, // You can change this to match your specific user data
	},
	email: {
		type: String, // You can add further validation for email
	},
});

const User = mongoose.model("User", userSchema);

export default User;
