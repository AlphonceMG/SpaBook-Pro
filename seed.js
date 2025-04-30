import mongoose from "mongoose"
import app from "./app.js" // Import the app.js file

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/eddahsDB')
  .then(() => {
    console.log('Connected to MongoDB');
    // Call the function to insert initial services, bridal services, and staff data
    Promise.all([
      insertInitialServices(),
      insertInitialBridalServices(),
      insertInitialStaff(),
    ])
      .then(() => {
        console.log('All initial data inserted successfully');
        // Close the database connection after all insertions are complete
        mongoose.connection.close();
      })
      .catch((err) => {
        console.error('Error inserting initial data:', err);
        // Close the database connection in case of an error
        mongoose.connection.close();
      });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

// Define an array of initial services with categories and descriptions
const initialServices = [
  {
    category: 'Waxing',
    name: 'Brazilian Wax',
    description: 'Description of Brazilian Wax',
    price: 1500,
    time: 45,
  },
  {
    category: 'Waxing',
    name: 'Bikini Wax',
    description: 'Description of Bikini Wax',
    price: 1000,
    time: 45,
  },
  {
    category: 'Waxing',
    name: 'Underarms Wax',
    description: 'Description of Underarms Wax',
    price: 600,
    time: 30,
  },
  {
    category: 'Waxing',
    name: 'Arms Wax',
    description: 'Description of Arms Wax',
    price: 1000,
    time: 30,
  },
  {
    category: 'Waxing',
    name: 'Thighs Wax',
    description: 'Description of Thighs Wax',
    price: 1500,
    time: 30,
  },
  {
    category: 'Waxing',
    name: 'Chin Wax',
    description: 'Description of Chin Wax',
    price: 600,
    time: 15,
  },
  {
    category: 'Waxing',
    name: 'Eyebrow Wax',
    description: 'Description of Eyebrow Wax',
    price: 300,
    time: 15,
  },
  {
    category: 'Waxing',
    name: 'Full Leg Wax',
    description: 'Description of Full Leg Wax',
    price: 3000,
    time: 45,
  },
  {
    category: 'Waxing',
    name: 'Half Legs Wax',
    description: 'Description of Half Legs Wax',
    price: 1000,
    time: 30,
  },
  {
    category: 'Waxing',
    name: 'Full Body Waxing',
    description: 'Description of Full Body Waxing',
    price: 10000,
    time: 180,
  },
  {
    category: 'Waxing',
    name: 'Vajiacial',
    description: 'Description of Thighs Wax',
    price: 1500,
    time: 30,
  },
  {
    category: 'Body Scrub',
    name: 'Body Scrub',
    description: 'Description of Body Scrub',
    price: 2500,
    time: 90,
  },
  {
    category: 'Body Scrub',
    name: 'Body Steam and Body Scrub',
    description: 'Description of Body Steam and Body Scrub',
    price: 3000,
    time: 120,
  },
  {
    category: 'Body Scrub',
    name: 'Couple Body Scrub',
    description: 'Description of Couple Body Scrub',
    price: 5500,
    time: 120,
  },
  {
    category: 'Steamings',
    name: 'Yoni Steam',
    description: 'Description of Yoni Steam',
    price: 1000,
    time: 30,
  },
  {
    category: 'Steamings',
    name: 'Body Steam',
    description: 'Description of Body Steam',
    price: 1000,
    time: 30,
  },
  {
    category: 'Body Massage',
    name: 'Swedish Massage',
    description: 'Description of Swedish Massage',
    price: 3000,
    time: 90,
  },
  {
    category: 'Body Massage',
    name: 'Deep Tissue Massage',
    description: 'Description of Deep Tissue Massage',
    price: 3500,
    time: 120,
  },
  {
    category: 'Body Massage',
    name: 'Couple Body Massage',
    description: 'Description of Couple Body Massage',
    price: 6000,
    time: 90,
  },
  {
    category: 'Facials',
    name: 'Full Facial',
    description: 'Description of Full Facial',
    price: 2000,
    time: 120,
  },
  {
    category: 'Facials',
    name: 'Back Facial',
    description: 'Description of Back Facial',
    price: 1500,
    time: 45,
  },
  {
    category: 'Lashes',
    name: 'Citizen Lashes',
    description: 'Description of Citizen Lashes',
    price: 2500,
    time: 45,
  },
  {
    category: 'Lashes',
    name: 'Classic Lashes',
    description: 'Description of Classic Lashes',
    price: 3500,
    time: 120,
  },
  {
    category: 'Lashes',
    name: 'Hybrid Lashes',
    description: 'Description of Hybrid Lashes',
    price: 4500,
    time: 150,
  },
  {
    category: 'Lashes',
    name: 'Mega Volume Lashes',
    description: 'Description of Mega Volume Lashes',
    price: 6000,
    time: 180,
  },
  {
    category: 'Eyebrows',
    name: 'Microblading, Microshading, Combination Brows',
    description: 'Description of Eyebrows Services',
    price: 15000,
    time: 120,
  },
  // Add more services as needed
];
// Define an array of initial bridal services
const initialBridalServices = [
  { name: 'Bride Inclusive of Lashes', price: 3000 },
  { name: 'Bride Exclusive of Lashes', price: 2500 },
  { name: 'Bridesmaids 5 or Less with Lashes', price: 2500 },
  { name: 'Bridesmaids 5 or Less without Lashes', price: 2000 },
  { name: 'Bridesmaids More Than 5 with Lashes', price: 2000 },
  { name: 'Bridesmaids More Than 5 without Lashes', price: 1500 },
];

const initialStaffData = [
  {
    firstName: 'Eddah',
    lastName: 'Doe',
    phoneNumber: '+254712345678',
    gender: 'Female',
    email: 'johndoe@example.com',
    idNumber: '12345678',
    nextOfKinIdNumber: '87654321',
    specialty: 'Waxing, Eyebrows, Body Massage, Body Scrubs, Facials',
    appointments: [],
    role: 'staff'
  },
  {
    firstName: 'Esther',
    lastName: 'Doe',
    phoneNumber: '+254723456789',
    gender: 'Female',
    email: 'estherdoe@example.com',
    idNumber: '23456789',
    nextOfKinIdNumber: '98765432',
    specialty: 'Waxing, Body Massage, Body Scrubs, Facials, Steamings',
    appointments: [],
    role: 'staff'
  },
  {
    firstName: 'Mercy',
    lastName: 'Doe',
    phoneNumber: '+254734567890',
    gender: 'Female',
    email: 'mercydoe@example.com',
    idNumber: '34567890',
    nextOfKinIdNumber: '09876543',
    specialty: 'Waxing, Body Massage, Body Scrubs, Facials, Steamings',
    appointments: [],
    role: 'staff'
  },
  {
    firstName: 'Peter',
    lastName: 'Doe',
    phoneNumber: '+254745678901',
    gender: 'Male',
    email: 'peterdoe@example.com',
    idNumber: '45678901',
    nextOfKinIdNumber: '10987654',
    specialty: 'Body Scrubs, Facial, Body Massage, Lashes, Steamings',
    appointments: [],
    role: 'staff'
  }
];


// Function to insert initial services into the database
const insertInitialServices = async () => {
  try {
    const Service = mongoose.model('Service');
    await Service.insertMany(initialServices);
    console.log('Initial services inserted successfully');
  } catch (error) {
    console.error('Error inserting initial services:', error);
  }
};

// Function to insert initial bridal services into the database
const insertInitialBridalServices = async () => {
  try {
    const BridalService = mongoose.model('BridalService'); // Update model name to BridalService
    await BridalService.insertMany(initialBridalServices); // Use the array defined above
    console.log('Initial bridal services inserted successfully');
  } catch (error) {
    console.error('Error inserting initial bridal services:', error);
  }
};

// Function to insert initial staff data into the database
const insertInitialStaff = async () => {
  try {
    const Staff = mongoose.model('Staff');
    await Staff.insertMany(initialStaffData);
    console.log('Initial staff data inserted successfully');
  } catch (error) {
    console.error('Error inserting initial staff data:', error);
  }
};

