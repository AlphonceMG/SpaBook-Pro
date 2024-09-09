import mongoose from "mongoose";

const bridalServiceSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
	},
	price: {
		type: Number,
		required: true,
		default: 0,
	},
});

const BridalService = mongoose.model("BridalService", bridalServiceSchema);

export default BridalService;