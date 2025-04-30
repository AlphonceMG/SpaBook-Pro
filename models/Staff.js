import mongoose from "mongoose";

const staffSchema = new mongoose.Schema({
	firstName: {
		type: String,
		required: [true, 'First name is required'],
		trim: true
	},
	lastName: {
		type: String,
		required: [true, 'Last name is required'],
		trim: true
	},
	phoneNumber: {
		type: String,
		required: [true, 'Phone number is required'],
		match: [/^\+254[17]\d{8}$/, 'Please enter a valid Kenyan phone number (+254XXXXXXXXX)']
	},
	specialty: {
		type: String,
		required: [true, 'Specialty is required']
	},
	gender: {
		type: String,
		required: [true, 'Gender is required'],
		enum: {
			values: ['Male', 'Female'],
			message: 'Gender must be either Male or Female'
		}
	},
	email: {
		type: String,
		required: [true, 'Email is required'],
		lowercase: true,
		match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
	},
	idNumber: {
		type: String,
		required: [true, 'ID number is required'],
		match: [/^\d{8}$/, 'ID number must be exactly 8 digits']
	},
	bookingDate: Date,
	nextOfKinIdNumber: {
		type: String,
		required: [true, 'Next of kin ID number is required'],
		match: [/^\d{8}$/, 'Next of kin ID number must be exactly 8 digits']
	},
	role: {
		type: String,
		enum: ['staff'],
		default: 'staff'
	},
	appointments: {
		type: [{
			dateTime: Date,
			service: {
				type: mongoose.Schema.Types.ObjectId,
				ref: 'Service'
			}
		}],
		default: []
	}
}, {
	timestamps: true
});

// Add indexes after schema definition
staffSchema.index({ email: 1 }, { unique: true });
staffSchema.index({ phoneNumber: 1 }, { unique: true });
staffSchema.index({ idNumber: 1 }, { unique: true });

const Staff = mongoose.model('Staff', staffSchema);

export default Staff;
