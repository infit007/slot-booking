// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const XLSX = require('xlsx');
const moment = require('moment');
const { body, validationResult } = require('express-validator');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(morgan('combined'));

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://slot-booking-lime.vercel.app'] // Vercel frontend URL
    : ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json());

// Database setup - PostgreSQL only
let pool = null;
let usePostgreSQL = true;

// Check if DATABASE_URL is provided
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required!');
  console.error('Please set your Render PostgreSQL database URL as an environment variable.');
  console.error('Example: DATABASE_URL=postgresql://username:password@hostname:port/database');
  process.exit(1);
}

console.log('Connecting to PostgreSQL database...');
console.log('DATABASE_URL (masked):', process.env.DATABASE_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));

pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
    sslmode: 'require'
  },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 20
});

// Test PostgreSQL connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error connecting to PostgreSQL database:', err.message);
    console.error('Error code:', err.code);
    console.error('Error detail:', err.detail);
    console.error('Error hint:', err.hint);
    console.error('Failed to connect to PostgreSQL. Please check your database configuration.');
    process.exit(1);
  } else {
    console.log('Connected to PostgreSQL database successfully.');
    console.log('Database time:', res.rows[0].now);
    initDatabase();
  }
});

// Add error handling for pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Initialize PostgreSQL database tables
function initDatabase() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      phone VARCHAR(20) NOT NULL,
      purpose TEXT NOT NULL,
      date DATE NOT NULL,
      time_slot TIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  pool.query(createTableQuery, (err, res) => {
    if (err) {
      console.error('Error creating PostgreSQL table:', err);
    } else {
      console.log('PostgreSQL bookings table created or already exists.');
    }
  });
}

// Helper function to check weekly booking restriction
const checkWeeklyBookingRestriction = (email, phone, slotDate, callback) => {
  let query = '';
  let params = [];
  
  if (email) {
    // Check by email (case-insensitive) or phone
    query = `SELECT COUNT(*) AS count
             FROM bookings
             WHERE (LOWER(email) = LOWER($1) OR phone = $2)
               AND date_trunc('week', date) = date_trunc('week', $3::date)`;
    params = [email, phone, slotDate];
  } else {
    // Check by phone only if no email
    query = `SELECT COUNT(*) AS count
             FROM bookings
             WHERE phone = $1
               AND date_trunc('week', date) = date_trunc('week', $2::date)`;
    params = [phone, slotDate];
  }
  
  pool.query(query, params, callback);
};

// Validation middleware
const validateBooking = [
  body('name').trim().isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters long').escape(),
  body('email').optional({ checkFalsy: true }).isEmail().normalizeEmail().withMessage('Must be a valid email').escape(),
  body('phone').matches(/^[\+]?[1-9][\d]{0,15}$/).withMessage('Must be a valid phone number').escape(),
  body('purpose').trim().isLength({ min: 5, max: 1000 }).withMessage('Purpose must be between 5 and 1000 characters long').escape(),
  body('date').isISO8601().withMessage('Must be a valid date'),
  body('time_slot').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Must be a valid time slot')
];

// Routes

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: 'PostgreSQL Connected',
    databaseUrl: 'Configured',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Get available slots for a specific date
app.get('/api/slots/:date', (req, res) => {
  const { date } = req.params;
  
  if (!moment(date, 'YYYY-MM-DD', true).isValid()) {
    return res.status(400).json({ error: 'Invalid date format' });
  }

  // Generate exactly 10 fixed time slots
  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', 
    '12:00', '15:00', '15:30', '16:00'
  ];

  // Get booking counts for each slot
  pool.query('SELECT time_slot::text, COUNT(*) as booking_count FROM bookings WHERE date = $1 GROUP BY time_slot', [date], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    // Create a map of slot booking counts
    const slotBookings = {};
    result.rows.forEach(row => {
      const timeSlot = row.time_slot.includes(':') ? row.time_slot.substring(0, 5) : row.time_slot;
      slotBookings[timeSlot] = parseInt(row.booking_count);
    });

    // Calculate slot status for each time slot
    const slotStatus = timeSlots.map(slot => {
      const bookingCount = slotBookings[slot] || 0;
      const isAvailable = bookingCount < 100;
      const isFullyBooked = bookingCount >= 100;
      
      return {
        time: slot,
        bookingCount: bookingCount,
        maxCapacity: 100,
        isAvailable: isAvailable,
        isFullyBooked: isFullyBooked,
        availableSpots: Math.max(0, 100 - bookingCount)
      };
    });

    const totalBookings = Object.values(slotBookings).reduce((sum, count) => sum + count, 0);
    const availableSlots = slotStatus.filter(slot => slot.isAvailable).map(slot => slot.time);
    const fullyBookedSlots = slotStatus.filter(slot => slot.isFullyBooked).map(slot => slot.time);

    console.log('API Response:', {
      date,
      slotStatus: slotStatus.length,
      availableSlots: availableSlots.length,
      fullyBookedSlots: fullyBookedSlots.length,
      totalBookings: totalBookings,
      maxBookings: 1000
    });

    res.json({
      date,
      slotStatus,
      availableSlots,
      fullyBookedSlots,
      allSlots: timeSlots,
      totalBookings: totalBookings,
      maxBookings: 1000
    });
  });
});

// Check if user has already booked this week
app.get('/api/user/weekly-status', (req, res) => {
  const { email, phone, date } = req.query;
  
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }
  
  const slotDate = date && moment(date, 'YYYY-MM-DD', true).isValid() ? date : moment().format('YYYY-MM-DD');
  checkWeeklyBookingRestriction(email, phone, slotDate, (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    const weeklyBookings = parseInt(result.rows[0].count);
    const hasBookedThisWeek = weeklyBookings > 0;
    
    res.json({
      hasBookedThisWeek,
      weeklyBookings,
      canBook: !hasBookedThisWeek,
      message: hasBookedThisWeek 
        ? 'You have already booked a slot this week' 
        : 'You can book a slot this week'
    });
  });
});

// Get overall slot statistics
app.get('/api/slots/status/overall', (req, res) => {
  const today = moment().format('YYYY-MM-DD');
  
  // Get today's bookings count
  pool.query('SELECT COUNT(*) as count FROM bookings WHERE date = $1', [today], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    const totalBookings = parseInt(result.rows[0].count);
    const maxSlots = 1000; // 1000 total slots per day
    const availableSlots = Math.max(0, maxSlots - totalBookings);
    
    res.json({
      date: today,
      availableSlots,
      totalBookings,
      maxSlots,
      utilizationRate: ((totalBookings / maxSlots) * 100).toFixed(1)
    });
  });
});

// Create a new booking
app.post('/api/bookings', validateBooking, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, phone, purpose, date, time_slot } = req.body;
  
  // Handle optional email - convert empty string to null
  const emailValue = email && email.trim() !== '' ? email : null;

    // Check if slot has capacity
  pool.query('SELECT COUNT(*) as count FROM bookings WHERE date = $1 AND time_slot = $2', [date, time_slot], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    const currentBookings = parseInt(result.rows[0].count);
    if (currentBookings >= 100) {
      return res.status(409).json({ error: 'This time slot is fully booked (100/100 capacity reached)' });
    }

    // Check weekly booking restriction (one booking per week per user)
    checkWeeklyBookingRestriction(emailValue, phone, date, (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      const weeklyBookings = parseInt(result.rows[0].count);
      if (weeklyBookings > 0) {
        return res.status(409).json({ error: 'You have already booked a slot this week. Only one booking per week is allowed.' });
      }

      // Check daily booking limit
      pool.query('SELECT COUNT(*) as count FROM bookings WHERE date = $1', [date], (err, result) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (parseInt(result.rows[0].count) >= 1000) {
          return res.status(409).json({ error: 'Daily booking limit reached (1000 bookings)' });
        }

              // Create booking
        pool.query(
          'INSERT INTO bookings (name, email, phone, purpose, date, time_slot) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
          [name, emailValue, phone, purpose, date, time_slot],
          (err, result) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to create booking' });
            }

            res.status(201).json({
              id: result.rows[0].id,
              message: 'Booking created successfully',
              booking: { name, email: emailValue, phone, purpose, date, time_slot }
            });
          }
        );
      });
    });
  });
});

// Get all bookings (admin endpoint)
app.get('/api/admin/bookings', (req, res) => {
  const { startDate, endDate } = req.query;
  
  let query = 'SELECT * FROM bookings';
  let params = [];
  
  if (startDate && endDate) {
    query += ' WHERE date BETWEEN $1 AND $2';
    params = [startDate, endDate];
  }
  
  query += ' ORDER BY date DESC, time_slot ASC';
  
  pool.query(query, params, (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(result.rows);
  });
});

// Delete a single booking (admin endpoint)
app.delete('/api/admin/bookings/:id', (req, res) => {
  const { id } = req.params;
  
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ error: 'Invalid booking ID' });
  }
  
  // First check if booking exists
  pool.query('SELECT * FROM bookings WHERE id = $1', [id], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    const booking = result.rows[0];
    
    // Delete the booking
    pool.query('DELETE FROM bookings WHERE id = $1', [id], (err, deleteResult) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete booking' });
      }
      
      res.json({
        message: 'Booking deleted successfully',
        deletedBooking: booking
      });
    });
  });
});

// Delete multiple bookings (admin endpoint)
app.delete('/api/admin/bookings', (req, res) => {
  const { ids } = req.body;
  
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Booking IDs array is required' });
  }
  
  // Validate all IDs are numbers
  const validIds = ids.filter(id => !isNaN(parseInt(id)));
  if (validIds.length !== ids.length) {
    return res.status(400).json({ error: 'Invalid booking ID format' });
  }
  
  // Get bookings before deletion for response
  pool.query('SELECT * FROM bookings WHERE id = ANY($1)', [validIds], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    const bookingsToDelete = result.rows;
    
    // Delete the bookings
    pool.query('DELETE FROM bookings WHERE id = ANY($1)', [validIds], (err, deleteResult) => {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete bookings' });
      }
      
      res.json({
        message: `${deleteResult.rowCount} booking(s) deleted successfully`,
        deletedBookings: bookingsToDelete,
        deletedCount: deleteResult.rowCount
      });
    });
  });
});

// Export bookings to Excel
app.get('/api/admin/export', (req, res) => {
  const { startDate, endDate } = req.query;
  
  let query = 'SELECT * FROM bookings';
  let params = [];
  
  if (startDate && endDate) {
    query += ' WHERE date BETWEEN $1 AND $2';
    params = [startDate, endDate];
  }
  
  query += ' ORDER BY date DESC, time_slot ASC';
  
  pool.query(query, params, (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    // Transform data for Excel
    const excelData = result.rows.map(row => ({
      'ID': row.id,
      'Name': row.name,
      'Email': row.email,
      'Phone': row.phone,
      'Purpose': row.purpose,
      'Date': row.date,
      'Time Slot': row.time_slot,
      'Created At': row.created_at
    }));

    // Create workbook and worksheet
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Bookings');

    // Generate filename
    const filename = `bookings_${startDate || 'all'}_${endDate || 'all'}_${moment().format('YYYY-MM-DD_HH-mm')}.xlsx`;

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    // Write to buffer and send
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.send(buffer);
  });
});

// Get booking statistics
app.get('/api/admin/stats', (req, res) => {
  const { date } = req.query;
  
  let query = 'SELECT COUNT(*) as total FROM bookings';
  let params = [];
  
  if (date) {
    query += ' WHERE date = $1';
    params = [date];
  }
  
  pool.query(query, params, (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
         res.json({
       totalBookings: parseInt(result.rows[0].total),
       maxBookings: 1000,
       availableBookings: 1000 - parseInt(result.rows[0].total)
     });
  });
});

// Remove static file serving - this is a backend-only deployment
// if (process.env.NODE_ENV === 'production') {
//   app.use(express.static(path.join(__dirname, '../client/build')));
//   
//   app.get('*', (req, res) => {
//     res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
//   });
// }

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'Set' : 'Not set'}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  pool.end((err) => {
    if (err) {
      console.error('Error closing PostgreSQL database pool:', err);
    } else {
      console.log('PostgreSQL database pool closed.');
    }
  });
  process.exit(0);
}); 