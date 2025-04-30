import mongoose from 'mongoose';
import Service from '../models/Service.js';

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/spabook')
    .then(() => console.log('Connected to MongoDB...'))
    .catch(err => console.error('Could not connect to MongoDB...', err));

async function removeDuplicates() {
    try {
        // Get all services
        const services = await Service.find({});
        
        // Create a map to track unique services by name
        const uniqueServices = new Map();
        const duplicates = [];

        // Identify duplicates
        services.forEach(service => {
            const key = service.name.toLowerCase().trim();
            if (uniqueServices.has(key)) {
                duplicates.push(service._id);
            } else {
                uniqueServices.set(key, service);
            }
        });

        // Remove duplicates
        if (duplicates.length > 0) {
            console.log(`Found ${duplicates.length} duplicate services. Removing...`);
            await Service.deleteMany({ _id: { $in: duplicates } });
            console.log('Duplicates removed successfully.');
        } else {
            console.log('No duplicates found.');
        }

        // Display remaining services
        const remainingServices = await Service.find({}).sort({ name: 1 });
        console.log('\nRemaining services:');
        remainingServices.forEach(service => {
            console.log(`- ${service.name}`);
        });

        mongoose.connection.close();
    } catch (error) {
        console.error('Error removing duplicates:', error);
        mongoose.connection.close();
    }
}

removeDuplicates(); 