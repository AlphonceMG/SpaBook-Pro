const express = require('express');
const bodyParser = require('body-parser');
const ejs = require('ejs');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('express-flash');
const { check, validationResult } = require('express-validator');
const argon2 = require('argon2');
const uuid = require('uuid');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || process.env.APP_PORT;

//app configurations
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Create a new MongoDB connection and use it for the session store
const sessionStore = MongoStore.create({
  mongoUrl: 'mongodb://127.0.0.1:27017/eddahsDB', // Adjust this URL to your MongoDB configuration
});

// Session configuration with session expiration
app.use(
  session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: true,
    store: sessionStore,
    cookie: {
      // Session expiration time (15 minutes)
      maxAge: 15 * 60 * 1000, // milliseconds
    },
  })
);

app.use(flash());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

mongoose
  .connect('mongodb://127.0.0.1:27017/eddahsDB', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('MongoDB connected successfully');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });

// Define schemas for 'admin', 'user', 'staff', 'service', and 'booking'
const adminSchema = new mongoose.Schema({
  name: String,
  email:String,
  uuid: String,
  password: String,
  role: {
    type: String,
    enum: ['admin', 'staff'],
    default: 'admin',
  },
  appointments: [
    {
      time: String, // Store the appointment time as a string (e.g., "10:00 am")
    },
  ],
});

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

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  time: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
});

const staffSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  phoneNumber: String,
  specialty: String,
  gender: String, // Add the gender field
  email: String, // Add the email field
  idNumber: String,   // Add the ID number field
  bookingDate:Date,
  nextOfKinIdNumber: String, // Add the Next of Kin ID number field
  role: {
    type: String,
    enum: ['staff'],
    default: 'staff',
  },
  appointments: [
    {
      dateTime: Date, // Store the appointment date and time as a Date object
    },
  ],
});

const bookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'canceled'],
    default: 'pending',
  },
  notes: {
    type: String,
  },
  price: {
    type: Number,
  },
  deposit:{
    type:Number
  },
  duration: {
    type: Number, // in minutes or hours
  },
  location: {
    type: String,
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'unpaid', 'partially paid'],
    default: 'unpaid',
  },
  invoiceNumber: {
    type: String,
  },
  staffMember: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff', // If a specific staff member is assigned
  },
  selectedServices: [
    // You might want to adjust the structure based on your Service model
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
    }
  ],
  selectedDateTime: {
    type: Date,
  },
  totalDeposit: {
    type: Number,
  },
  // Add more fields as needed
});

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

const bridalServicesSchema = new mongoose.Schema({
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

const User = mongoose.model('User',userSchema);
const Admin = mongoose.model('Admin', adminSchema);
const Staff = mongoose.model('Staff', staffSchema);
const Service = mongoose.model('Service', serviceSchema);
const Booking = mongoose.model('Booking', bookingSchema);
const BridalBooking = mongoose.model('BridalBooking', bridalBookingSchema);
const BridalService = mongoose.model('BridalService', bridalServicesSchema);
const Log = mongoose.model('Log', logSchema);

// Define a middleware function to log user actions
async function logUserJourney(req, res, next) {
  // Check if the session has expired
  if (req.session && req.session.userJourney) {
    // Log the current user action or store it in the session
    const userAction = req.originalUrl;
    req.session.userJourney.push(userAction);

    // Capture additional information
    const ipAddress = req.ip; // Capture user's IP address
    const useragent = req.get('User-Agent'); // Capture user agent
    const sessionID = req.sessionID; // Capture session ID
    const httpMethod = req.method; // Capture HTTP method
    const requestBody = req.body; // Capture request body or parameters
    const responseStatus = res.statusCode; // Capture response status code
    const referrer = req.get('Referrer'); // Capture referrer
    const userLocation =
      req.headers['x-forwarded-for'] || req.connection.remoteAddress; // Capture user location
    const userRole = req.session.userRole || ''; // Capture user role if available
    const userID = req.session.userUUID || ''; // Capture user ID if available
    const actionDescription = ''; // Add your own description for the action

    let firstName = '';
    let lastName = '';

    // Determine the source of names based on the user's action
    if (userAction === '/bookings-registration') {
      // Get first and last names from the User registration
      const user = await User.findOne({ _id: userID });
      if (user) {
        firstName = user.firstName;
        lastName = user.lastName;
      }
    } else if (userAction === '/bridal-registration') {
      // Get first and last names from the Bridal registration
      const bridalBooking = await BridalBooking.findOne({ _id: userID });
      if (bridalBooking) {
        firstName = bridalBooking.firstName;
        lastName = bridalBooking.lastName;
      }
    } else if (userAction === '/staff-registration') {
      // Get first and last names from the Staff registration
      const staff = await Staff.findOne({ _id: userID });
      if (staff) {
        firstName = staff.firstName;
        lastName = staff.lastName;
      }
    }
    try {
      // Create a new log entry and save it to the database
      const logEntry = new Log({
        firstName,
        lastName,
        userUUID: userID,
        action: userAction,
        ipAddress,
        useragent,
        sessionID,
        httpMethod,
        requestBody,
        responseStatus,
        referrer,
        userLocation,
        userRole,
        actionDescription,
      });

    // Log the data before saving it
    console.log('Log Entry Data:', logEntry);

      await logEntry.save();
    } catch (err) {
      console.error('Error logging user action:', err);
    }
  } else {
    // Session has expired or is not available, log session exit time
    if (req.session && req.session.sessionEntryTime) {
      // Log the session exit time
      const exitTime = new Date();
      const entryTime = req.session.sessionEntryTime;
      const sessionDuration = exitTime - entryTime;

      // Log the session exit time and duration
      try {
        const sessionExitLog = new Log({
          sessionID: req.sessionID,
          action: 'Session Exit',
          sessionExitTime: exitTime,
          sessionDuration: sessionDuration,
        });

        await sessionExitLog.save();
      } catch (err) {
        console.error('Error logging session exit time:', err);
      }
    }
  }
  next();
}

// Use the user journey logging middleware for all routes
app.use(logUserJourney);

// Middleware to track session entry time
app.use((req, res, next) => {
  if (req.session) {
    req.session.sessionEntryTime = new Date();
  }
  next();
});

app.get('/', (req, res) => {
  res.render('home');
});
// Define the isAdmin function
function isAdmin(req, res, next) {
  if (req.session.userUUID) {
    Admin.findOne({ uuid: req.session.userUUID })
      .then((user) => {
        if (user.role === 'admin') {
          return next();
        }
        res.redirect('/');
      })
      .catch((error) => {
        console.error('Error checking admin role:', error);
        res.redirect('/');
      });
  } else {
    res.redirect('/login');
  }
}

console.log('POST request to /admin/signup received');

// Admin Signup Routes
app.route('/admin/signup')
  .get((req, res) => {
    const messages = req.flash();
    res.render('admin-signup', { errors: [], messages });
  })
  .post(
    [
      check('adminEmail')
        .notEmpty()
        .withMessage('Email address is required')
        .isEmail()
        .withMessage('Invalid email address')
        .normalizeEmail(),
      check('adminPassword')
        .notEmpty()
        .withMessage('Password is required')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[!@#$%^&*])/)
        .withMessage('Password must contain at least one special character'),
      check('confirmPassword').custom((value, { req }) => {
        if (!req.body.adminPassword || value !== req.body.adminPassword) {
          throw new Error('Passwords do not match');
        }
        return true;
      }),
    ],
    async (req, res) => {
      try {
        console.log('POST request to /admin/signup received');
        console.log('Form Data:', req.body);
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
          console.error('Validation errors:', errors.array());
          const messages = req.flash();
          return res.render('admin-signup', { errors: errors.array(), messages });
        }

        const { adminEmail, adminPassword } = req.body;
        const adminCount = await Admin.countDocuments({ role: 'admin' });

        if (adminCount === 0) {
          const hashedPassword = await argon2.hash(adminPassword); // Use argon2.hash directly
          const adminUUID = uuid.v4();

          const newAdmin = new Admin({
            uuid: adminUUID,
            email: adminEmail,
            password: hashedPassword,
            role: 'admin',
          });

          await newAdmin.save();

          req.session.userUUID = adminUUID;
          req.flash('success', 'Registration successful!');
          res.redirect('/admin/home');
        } else {
          req.flash('error', 'Admin account already exists.');
          res.redirect('/admin/signup');
        }
      } catch (err) {
        console.error('Error:', err);
        req.flash('error', 'Registration failed.');
        res.redirect('/admin/signup'); // Redirect back to the signup page
      }
    }
  );

// Login Routes
app.route('/admin/login')
  .get((req, res) => {
    // Check if the user accessing the login page is an admin
    if (req.session.userUUID) {
      Admin.findOne({ uuid: req.session.userUUID })
        .then((user) => {
          if (user.role === 'admin') {
            res.render('admin-login'); // Render the login page for admin users
          } else {
            res.redirect('/'); // Redirect non-admin users to the home page
          }
        })
        .catch((error) => {
          console.error('Error checking admin role:', error);
          res.redirect('/');
        });
    } else {
      res.redirect('/'); // Redirect users who are not logged in to the home page
    }
  })
  .post(async (req, res) => {
    const { email, password } = req.body;

    try {
      const user = await Admin.findOne({ email });

      if (user) {
        const passwordMatch = await argon2.verify(user.password, password);

        if (passwordMatch) {
          req.session.userUUID = user.uuid;
          if (user.role === 'admin') {
            res.redirect('/admin/home');
          } else {
            res.redirect('/home');
          }
        } else {
          res.redirect('/admin/login');
        }
      } else {
        res.redirect('/admin/login');
      }
    } catch (error) {
      console.error('Error logging in:', error);
      res.redirect('/admin/login');
    }
  });

// Admin Home Page
app.get('/admin/home', isAdmin, async (req, res) => {
  try {
    // Fetch all services from the database
    const services = await Service.find({});
    res.render('admin-home', { services });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.redirect('/');
  }
});

// Admin Services Page
app.route('/admin/services')
  .get(isAdmin, async (req, res) => {
    try {
      const services = await Service.find();
      res.render('admin-services', { services });
    } catch (error) {
      console.error('Error fetching services:', error);
      req.flash('error', 'Failed to fetch services.');
      res.redirect('/admin/home'); // Redirect to admin home or appropriate page
    }
  });

// Define a route for adding services
app.route('/admin/addservice')
  .get(isAdmin, (req, res) => {
    // Render the add-service form when a GET request is made
    res.render('admin-addservice');
  })
  .post(isAdmin, async (req, res) => {
    // Handle the form submission to add a new service when a POST request is made
    const { name, description, price, time } = req.body;

    try {
      // Create a new service instance
      const newService = new Service({
        name,
        description,
        price,
        time,
      });

      // Save the service to the database
      await newService.save();

      // Flash a success message and redirect to the admin services page
      req.flash('success', 'Service added successfully.');
      res.redirect('/admin/services');
    } catch (error) {
      console.error('Error adding a service:', error);

      // Flash an error message and redirect back to the add-service form
      req.flash('error', 'Failed to add service.');
      res.redirect('/admin/addservice');
    }
  });

// Delete Service routes using app.route
app.route('/admin/deleteservices')
  .get(isAdmin, async (req, res) => {
    try {
      // Fetch all services from the database
      const services = await Service.find();
      res.render('admin-deleteservices', { services });
    } catch (error) {
      console.error('Error fetching services:', error);
      req.flash('error', 'Failed to fetch services.');
      res.redirect('/admin/services'); // Redirect to the appropriate page on error
    }
  })
  .post(isAdmin, async (req, res) => {
    const selectedServiceIds = req.body.selectedServices; // This will be an array of selected service IDs

    // Check if the user is authenticated and is an admin
    if (req.session.userUUID) {
      try {
        // Use the selectedServiceIds array to delete multiple services at once
        await Service.deleteMany({ _id: { $in: selectedServiceIds } });
        req.flash('success', 'Selected services deleted successfully.');
        res.redirect('/admin/services'); // Redirect to the admin services page after deleting the services
      } catch (error) {
        console.error('Error deleting services:', error);
        req.flash('error', 'Failed to delete selected services.');
        res.redirect('/admin/services'); // Redirect back to the admin services page with an error message
      }
    } else {
      res.redirect('/login'); // Redirect to the login page if not authenticated
    }
  });

app.route('/admin/addstaff')
  .get((req, res) => {
    // Check if the user accessing the add staff page is an admin
    if (req.session.userUUID) {
      Admin.findOne({ uuid: req.session.userUUID })
        .then((user) => {
          if (user.role === 'admin') {
            const messages = req.flash();
            res.render('admin-addstaff', { errors: [], messages });
          } else {
            res.redirect('/'); // Redirect non-admin users to the home page
          }
        })
        .catch((error) => {
          console.error('Error checking admin role:', error);
          res.redirect('/');
        });
    } else {
      res.redirect('/'); // Redirect users who are not logged in to the home page
    }
  })
  .post(async (req, res) => {
    // Check if the user accessing the add staff page is an admin
    if (req.session.userUUID) {
      Admin.findOne({ uuid: req.session.userUUID })
        .then(async (user) => { // Mark this function as async
          if (user.role === 'admin') {
            // Add checks and validation here
            if (!req.body.firstName || !req.body.lastName || !req.body.phoneNumber || !req.body.speciality || !req.body.gender || !req.body.email || !req.body.idNumber || !req.body.nextOfKinIdNumber) {
              // If any of the required fields is missing, return an error
              req.flash('error', 'All fields are required');
              return res.redirect('/admin/addstaff');
            }

            // Create a new staff member using the data from the form
            const newStaff = new Staff({
              firstName: req.body.firstName,
              lastName: req.body.lastName,
              phoneNumber: req.body.phoneNumber,
              speciality: req.body.speciality,
              gender: req.body.gender,
              email: req.body.email,
              idNumber: req.body.idNumber,
              nextOfKinIdNumber: req.body.nextOfKinIdNumber,
            });

            // Save the staff member to the database
            await newStaff.save();

            // Redirect to a success page or another appropriate route
            res.redirect('/success'); // Customize the success route as needed
          } else {
            res.redirect('/'); // Redirect non-admin users to the home page
          }
        })
        .catch((error) => {
          console.error('Error checking admin role:', error);
          res.redirect('/');
        });
    } else {
      res.redirect('/'); // Redirect users who are not logged in to the home page
    }
  });

app.route('/staff/registration')
  .get((req, res) => {
    res.render('staff-registration');
  })
  .post(isAdmin, async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        phoneNumber,
        gender,
        email,
        idNumber,
        nextOfKinIdNumber,
        speciality
      } = req.body;

      // Validation checks
      if (!/^\+254[17]\d{8}$/.test(phoneNumber)) {
        return res.status(400).send('Invalid phone number format');
      }

      if (!/^\w+@\w+\.\w+$/.test(email)) {
        return res.status(400).send('Invalid email address format');
      }

      if (!/^\d{8}$/.test(idNumber)) {
        return res.status(400).send('Invalid ID number format');
      }

      // Create a new staff instance
      const newStaff = new StaffModel({
        firstName,
        lastName,
        phoneNumber,
        gender,
        email,
        idNumber,
        nextOfKinIdNumber,
        speciality
      });

      // Save the staff to the database using async/await
      const savedStaff = await newStaff.save();

      res.status(201).json(savedStaff);
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

// Define a route for displaying services
app.route('/services')
  .get(async (req, res) => {
    try {
      // Fetch all services from the database
      const services = await Service.find({});
      if (!services) {
        // Handle the case where no services are found
        req.flash('error', 'No services found.');
        res.redirect('/'); // Redirect to the appropriate page
        return;
      }
      
      // Render the services.ejs template and pass the services object
      res.render('services', { services });
    } catch (error) {
      console.error('Error fetching services:', error);
      req.flash('error', 'Failed to fetch services.');
      res.redirect('/'); // Redirect to the appropriate page on error
    }
  });

app.get('/staff', async (req, res) => {
  try {
    const staffMembers = await Staff.find({}, 'firstName lastName specialty');

    res.render('staff', { staffMembers });
  } catch (error) {
    console.error('Error fetching staff members:', error);
    res.redirect('/');
  }
});

app.get('/bookings', async (req, res) => {
    try {
        // Fetch staff members data from your MongoDB database
        staffMembers = await Staff.find({}, 'firstName lastName specialty');

        // Check if selected services are stored in the user's session
        const selectedServices = req.session.selectedServices || [];

        // Render the 'bookings.ejs' template and pass staff members and selected services
        res.render('bookings', { staff: staffMembers, selectedServices }); // Pass staffMembers here
    } catch (error) {
        console.error('Error fetching staff members:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
let services = []
// Your GET route for rendering the services page
app.get('/bookings/services', async (req, res) => {
  try {
    // Fetch services data from your MongoDB database
    services = await Service.find({});
    // Create an object to organize services by categories
    const servicesByCategory = {};
    services.forEach((service) => {
      const { category } = service;
      if (!servicesByCategory[category]) {
        servicesByCategory[category] = [];
      }
      servicesByCategory[category].push(service);
    });

    // Fetch categories data from the database
    const categories = Object.keys(servicesByCategory);
    
    // Get the search term from the query parameter
    const searchTerm = req.query.search || '';

    // Render the 'bookings-services.ejs' template and pass the organized services, categories, searchTerm, and totalDeposit
    res.render('bookings-services', { services: servicesByCategory, categories, searchTerm});
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Your POST route for selecting a service
app.post('/bookings/services/select', async (req, res) => {
    const serviceName = req.body.serviceName;
    try {
        const selectedService = await Service.findOne({ name: serviceName });
        if (selectedService) {
            selectedService.selected = true;
            await selectedService.save();
            // Update the services array with the updated selected service
            const updatedServices = services.map((service) => (service.name === serviceName ? selectedService : service));
            services = updatedServices;
            // Calculate the total deposit based on selected services
            const selectedServices = services.filter((service) => service.selected);
            const totalDeposit = calculateTotalDeposit(selectedServices);
            // Store selectedServices and totalDeposit in the session
            req.session.selectedServices = selectedServices;
            req.session.totalDeposit = totalDeposit;

            // Log the selectedServices and totalDeposit for debugging
            console.log('Selected Services:', selectedServices);
            console.log('Total Deposit:', totalDeposit);

            res.json({ success: true, totalDeposit, selected: true });
        } else {
            res.json({ success: false, error: 'Service not found' });
        }
    } catch (error) {
        console.error('Error selecting service:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Your POST route for deselecting a service
app.post('/bookings/services/deselect', async (req, res) => {
    const serviceName = req.body.serviceName;
    try {
        const deselectedService = await Service.findOne({ name: serviceName });
        if (deselectedService) {
            deselectedService.selected = false;
            await deselectedService.save();
            // Update the services array with the updated deselected service
            const updatedServices = services.map((service) => (service.name === serviceName ? deselectedService : service));
            services = updatedServices;
            // Calculate the total deposit based on selected services
            const selectedServices = services.filter((service) => service.selected);
            const totalDeposit = calculateTotalDeposit(selectedServices);
            // Store selectedServices and totalDeposit in the session
            req.session.selectedServices = selectedServices;
            req.session.totalDeposit = totalDeposit;

            // Log the selectedServices and totalDeposit for debugging
            console.log('Selected Services:', selectedServices);
            console.log('Total Deposit:', totalDeposit);

            res.json({ success: true, totalDeposit, selected: false });
        } else {
            res.json({ success: false, error: 'Service not found' });
        }
    } catch (error) {
        console.error('Error deselecting service:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Function to calculate the total deposit amount based on selected services
function calculateTotalDeposit(selectedServices) {
  let totalDeposit = 0;
  for (const service of selectedServices) {
    totalDeposit += 0.6 * parseFloat(service.price);
  }
  return totalDeposit;
}

app.route('/bookings/appointments')
  .get(async (req, res) => {
    try {
      const services = await Service.find();
      const staff = await Staff.find();
      const selectedDateTime = new Date();

      // Access selected services from the session
      let selectedServices = req.session.selectedServices || [];

      // Define selectedService or retrieve it from the request body, query, or params
      const selectedService = req.body.selectedService || req.query.selectedService || req.params.selectedService;
      
      // Set default values for selectedDateTime, selectedService, and totalDeposit
      req.session.selectedDateTime = selectedDateTime;
      req.session.selectedService = selectedService;
      req.session.totalDeposit = req.session.totalDeposit || 0;

      // Update the session with the latest selected services
      if (selectedService) {
        const existingServiceIndex = selectedServices.findIndex(service => service.name === selectedService.name);
        if (existingServiceIndex === -1) {
          selectedServices.push(selectedService);
        } else {
          selectedServices[existingServiceIndex] = selectedService;
        }
        // Update the session with the modified selected services
        req.session.selectedServices = selectedServices;
        req.session.totalDeposit = calculateTotalDeposit(selectedServices);

        // Ensure that selectedSpecialist and selectedStaff are defined
        const storedSelectedStaff = req.session.selectedStaff || {};
        const selectedStaff = {
          firstName: storedSelectedStaff.name.split(' ')[0], // Modify based on your data structure
          lastName: storedSelectedStaff.name.split(' ')[1], // Modify based on your data structure
          ...storedSelectedStaff
        };

        req.session.selectedStaff = {
          id: selectedStaff.id,
          name: `${selectedStaff.firstName} ${selectedStaff.lastName}`,
          specialty: selectedStaff.specialty
        };
      }

      // Log the session information to the console
      console.log(req.session);

      // Define the isStaffAvailable function here
      function isStaffAvailable(selectedStaff, selectedDateTime, selectedService = null) {
        // Check if selectedService is provided and not null
        if (selectedService) {
          const serviceTime = selectedService.time;
          const selectedAppointmentStartTime = new Date(selectedDateTime);
          const selectedAppointmentEndTime = new Date(
            selectedAppointmentStartTime.getTime() + serviceTime * 60000
          );

          // Check if the selected staff has any conflicting appointments
          return !selectedStaff.appointments.some((appointment) => {
            const appointmentStartTime = new Date(appointment.datetime);
            const appointmentEndTime = new Date(
              appointmentStartTime.getTime() + serviceTime * 60000
            );
            return (
              (selectedAppointmentStartTime >= appointmentStartTime &&
                selectedAppointmentStartTime < appointmentEndTime) ||
              (selectedAppointmentEndTime > appointmentStartTime &&
                selectedAppointmentEndTime <= appointmentEndTime)
            );
          });
        } else {
          // Handle the case where selectedService is not provided
          // You can choose the appropriate behavior here
          return false; // For example, return false when no service is selected
        }
      }
      res.render('bookings-appointments', {
        services,
        staff,
        isStaffAvailable,
        selectedDateTime,
        selectedService,
        selectedServices: req.session.selectedServices,
        totalDeposit: req.session.totalDeposit // Use the session value here
      });
    } catch (error) {
      console.error(error);
      res.status(500).send(`Internal Server Error: ${error.message}`);
    }
  })
  .post(async (req, res) => {
    const { staffId, service, selectedDateTime } = req.body;

    try {
      const selectedStaff = await Staff.findById(staffId);
      const selectedAppointmentStartTime = new Date(selectedDateTime);
      const selectedService = await Service.findOne({ name: service });
      const serviceTime = selectedService.time;
      const selectedAppointmentEndTime = new Date(
        selectedAppointmentStartTime.getTime() + serviceTime * 60000
      );

      const isAvailable = isStaffAvailable(selectedStaff, selectedDateTime, selectedService);

      if (isAvailable) {
        selectedStaff.appointments.push({ datetime: selectedDateTime, service });
        await selectedStaff.save();
        // Store selectedSpecialist in the session
        req.session.selectedSpecialist = {
          id: selectedStaff._id,
          name: `${selectedStaff.firstName} ${selectedStaff.lastName}`,
          specialty: selectedStaff.specialty
        };
        res.send('Appointment booked successfully.');
      } else {
        res.send(
          'Staff member is not available at the selected time. Please choose another time or service.'
        );
      }
    } catch (error) {
      console.error(error);
      res.status(500).send(`Internal Server Error: ${error.message}`);
    }
  });
// New route for '/bookings/appointments/staff'
app.get('/bookings/appointments/staff', async (req, res) => {
  try {
    const specialty = req.query.specialty;
    let filteredStaff;

    if (specialty) {
      // If a specific service category is selected, filter staff by specialty
      filteredStaff = await Staff.find({ specialty: { $in: [specialty] } });
    } else {
      // If no specific service category is selected, return all staff
      filteredStaff = await Staff.find();
    }
    res.json(filteredStaff);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
// Define a route for the Booking registration form 
app.route('/bookings/registration')
  .get(async (req, res) => {
    try {

      // Get the booking status from the session (if available)
      const bookingStatus = req.session.bookingStatus || '';
      const selectedServices = req.session.selectedServices || [];
      const selectedDateTime = req.session.selectedDateTime || '';
      const totalDeposit = req.session.totalDeposit || 0;

      // Retrieve staff members from the database (modify this based on your database setup)
      const staffData = await Staff.find().exec();

      // Retrieve selectedSpecialist from the session
      const selectedStaff = req.session.selectedSpecialist || null;

      res.render('bookings-registration', { bookingStatus, staffData, selectedStaff, selectedServices, selectedDateTime, totalDeposit });
    } catch (err) {
      console.error('Error retrieving staff members:', err);
      // Handle the error and redirect to an error page
      res.redirect('/error');
    }
  })
  .post(async (req, res) => {
    try {

      // Retrieve session data
      const selectedServices = req.session.selectedServices || [];
      const selectedDateTime = req.session.selectedDateTime || '';
      const totalDeposit = req.session.totalDeposit || 0;
      const selectedStaff = req.session.selectedStaff || null;

      console.log('Selected Staff from session:', selectedStaff);

      const { firstName, lastName, phoneNumber, gender, email} = req.body;

      console.log('Received user registration data:');
      console.log('First Name:', firstName);
      console.log('Last Name:', lastName);
      console.log('Phone Number:', phoneNumber);
      console.log('Gender:', gender);
      console.log('Email:', email);
  
      // Check if a user with the same phone number already exists in the database
      const existingUser = await User.findOne({ phoneNumber });

      if (existingUser) {
        // Set the booking status in the session to indicate that a similar booking exists
        req.session.bookingStatus = 'A similar booking already exists';
        res.redirect('/bookings/registration');
      } else {
        // Create a new user instance
        const newUser = new User({
          firstName,
          lastName,
          phoneNumber,
          gender,
          email,
        });

        // Save the user data to the database
        await newUser.save();

        // Retrieve service names based on ObjectIds
        const selectedServicesData = await Service.find({ _id: { $in: selectedServices } });
        const selectedServiceNames = selectedServicesData.map(service => service.name);

        // Create a new booking instance
        const newBooking = new Booking({
          user: newUser._id,
          staffMember: selectedStaff,
          selectedServices,  
          selectedDateTime,   
          totalDeposit,    
        });

        // Save the booking data to the database
        await newBooking.save();

        console.log('User registered successfully:');
        console.log(newUser);

        console.log('Booking saved successfully:');
        console.log(newBooking);

        // Set the booking status in the session to indicate a successful booking
        req.session.bookingStatus = 'Successfully booked';

        res.redirect('/bookings/registration');
      }
    } catch (error) {
      console.error('Error registering user:', error);
      // Handle error and redirect to an error page
      res.redirect('/error');
    }
  });

// Your GET route for rendering the Bridal Services page
app.get('/bridal/services', async (req, res) => {
  try {
    // Check if it's a page reload (GET request) or moving to the next page (POST request)
    if (req.method === 'GET') {
      // Clear selected services from the session on page reload
      req.session.selectedServices = [];
    }

    // Fetch bridal services from the database
    const bridalServices = await BridalService.find({});
    
    // Retrieve selected services from the session or initialize an empty array
    const selectedServiceNames = (req.session.selectedServices || []).map(service => service.name);

    // Initialize bridalSelectedServices object 
    const bridalSelectedServices = {};
    
    // Set the selection state for each bridal service based on the selectedServiceNames array
    for (const service of bridalServices) {
      bridalSelectedServices[service.name] = selectedServiceNames.includes(service.name);
    }

    console.log('Bridal Services:', bridalServices);
    console.log('Selected Service Names:', selectedServiceNames);
    console.log('Bridal Selected Services:', bridalSelectedServices);

    res.render('bridal-services', { bridalServices, selectedServiceNames, bridalSelectedServices });
  } catch (error) {
    console.error('Error fetching bridal services:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Your POST route for selecting or deselecting a bridal service
app.post('/bridal/services/select-deselect/:action', async (req, res) => {
  const serviceName = req.body.bridalServiceName;
  const action = req.params.action;

  try {
    if (action === 'select') {
      // Update the session to include the selected service
      req.session.selectedServices = [...(req.session.selectedServices || []), { name: serviceName }];
    } else if (action === 'deselect') {
      // Update the session to remove the deselected service
      req.session.selectedServices = (req.session.selectedServices || []).filter(service => service.name !== serviceName);
    }

    console.log('Action:', action);
    console.log('Service Name:', serviceName);
    console.log('Updated Selected Services:', req.session.selectedServices);

    res.json({ success: true, selected: action === 'select' });
  } catch (error) {
    console.error('Error updating bridal service selection:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Route for Bridal Registration
app.route('/bridal/registration')
  .get((req, res) => {
    // Render the Bridal registration form
    res.render('bridal-registration', { registrationStatus: req.session.registrationStatus });
  })
  .post([
    check('emailAddress')
      .isEmail()
      .withMessage('Invalid email address'),
    check('phoneNumber')
      .isMobilePhone('any', { strictMode: false })
      .withMessage('Invalid phone number'),
    check('weddingDate')
      .isISO8601()
      .withMessage('Invalid wedding date'),
  ], async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.error('Validation errors:', errors.array());
        // Handle validation errors and render the form with error messages
        return res.render('bridal-registration', { errors: errors.array() });
      }

      const {
        firstName,
        lastName,
        emailAddress,
        phoneNumber,
        brideMaids,
        weddingDate,
        weddingLocation,
      } = req.body;

      // Check if a similar bridal registration already exists
      const existingBridalBooking = await BridalBooking.findOne({ phoneNumber, weddingDate });

      if (existingBridalBooking) {
        req.session.registrationStatus = 'A similar bridal registration already exists';
      } else {
        // Generate a unique UUID for the registering person
        const userUUID = uuid.v4();

        // Create a new BridalBooking instance with the specific fields and the generated UUID
        const bridalBooking = new BridalBooking({
          uuid: userUUID,
          firstName,
          lastName,
          emailAddress,
          phoneNumber,
          brideMaids,
          weddingDate,
          weddingLocation,
        });

        // Save the Bridal registration details to the database
        await bridalBooking.save();

        req.session.registrationStatus = 'Bridal registration successful!';
      }

      // Redirect back to the Bridal registration page
      res.redirect('/bridal/registration');
    } catch (error) {
      console.error('Error registering Bridal:', error);
      req.session.registrationStatus = 'Bridal registration failed.';
      res.redirect('/bridal/registration'); // Redirect back to the Bridal form with an error message
    }
  });

// mpesa routes
const mpesa = require('./routes/index');
app.use('/mpesa',mpesa);

app.get('/admin/userjourney', isAdmin, async (req, res) => {
  try {
    // Fetch user journey data from the Log model (assuming you have a UserJourneyStatistics model)
    const userJourneyData = await Log.find({});

    // Create an object to pass data to your EJS template
    const data = userJourneyData.map((logEntry) => ({
      firstName: logEntry.firstName,
      lastName: logEntry.lastName,
      timestamp: logEntry.timestamp,
      action: logEntry.action,
      ipAddress: logEntry.ipAddress,
      useragent: logEntry.useragent,
      userID: logEntry.userID,
      actionDescription: logEntry.actionDescription,
    }));

    // Render your EJS template and pass the data
    res.render('admin-userjourney', { data });
  } catch (error) {
    console.error('Error fetching user journey data:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

// 'purgeLogs' function and schedule it to run
const purgeLogs = async () => {
  try {
    // Calculate the date that's 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Delete logs older than 30 days
    await Log.deleteMany({ timestamp: { $lt: thirtyDaysAgo } });

    console.log('Log entries older than 30 days have been purged.');
  } catch (error) {
    console.error('Error purging old logs:', error);
  }
};

// Schedule log purging every 24 hours (adjust the interval as needed)
setInterval(purgeLogs, 24 * 60 * 60 * 1000);

module.exports = {
  app,
  Service,
  Admin,
  Staff,
  BridalBooking,
  BridalService
};

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
