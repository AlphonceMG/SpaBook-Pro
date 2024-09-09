import mongoose from "mongoose";

const logSchema = new mongoose.Schema({
	firstName: String,
	lastName: String,
	userUUID: String, // If available
	timestamp: { type: Date, default: Date.now },
	action: String,
	ipAddress: String, // Add IP address field
	useragent: String, // Add user agent field
	sessionID: String, // Add session ID field
	httpMethod: String, // Add HTTP method field
	requestBody: Object, // Add request body field
	responseStatus: Number, // Add response status code field
	referrer: String, // Add referrer field
	userLocation: String, // Add user location field
	userRole: String, // Add user role field
	userID: String, // Add user ID field
	actionDescription: String, // Add action description field
});

const Log = mongoose.model("Log", logSchema);

export default Log;