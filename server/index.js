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
app.use(helmet());
app.use(morgan('combined'));

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-vercel-app.vercel.app'] // Replace with your actual Vercel URL
    : ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(express.json());

// PostgreSQL database setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error connecting to PostgreSQL:', err);
  } else {
    console.log('Connected to PostgreSQL database.');
    initDatabase();
  }
});

// Initialize database tables
function initDatabase() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      purpose TEXT NOT NULL,
      date DATE NOT NULL,
      time_slot TIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  pool.query(createTableQuery, (err, res) => {
    if (err) {
      console.error('Error creating table:', err);
    } else {
      console.log('Bookings table created or already exists.');
    }
  });
}

// Validation middleware
const validateBooking = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name must be at least 2 characters long'),
  body('email').isEmail().normalizeEmail().withMessage('Must be a valid email'),
  body('phone').matches(/^[\+]?[1-9][\d]{0,15}$/).withMessage('Must be a valid phone number'),
  body('purpose').trim().isLength({ min: 5 }).withMessage('Purpose must be at least 5 characters long'),
  body('date').isISO8601().withMessage('Must be a valid date'),
  body('time_slot').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Must be a valid time slot')
];

// Routes

// Get available slots for a specific date
app.get('/api/slots/:date', (req, res) => {
  const { date } = req.params;
  
  if (!moment(date, 'YYYY-MM-DD', true).isValid()) {
    return res.status(400).json({ error: 'Invalid date format' });
  }

  // Generate time slots (30-minute intervals from 9 AM to 6 PM)
  const timeSlots = [];
  const startTime = moment('09:00', 'HH:mm');
  const endTime = moment('18:00', 'HH:mm');
  
  while (startTime.isBefore(endTime)) {
    timeSlots.push(startTime.format('HH:mm'));
    startTime.add(30, 'minutes');
  }

  // Get booked slots for the date
  pool.query('SELECT time_slot::text FROM bookings WHERE date = $1', [date], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    const bookedSlots = result.rows.map(row => row.time_slot);
    const availableSlots = timeSlots.filter(slot => !bookedSlots.includes(slot));

    res.json({
      date,
      availableSlots,
      bookedSlots,
      totalBookings: bookedSlots.length,
      maxBookings: 50
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

  // Check if slot is already booked
  pool.query('SELECT id FROM bookings WHERE date = $1 AND time_slot = $2', [date, time_slot], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (result.rows.length > 0) {
      return res.status(409).json({ error: 'This time slot is already booked' });
    }

    // Check daily booking limit
    pool.query('SELECT COUNT(*) as count FROM bookings WHERE date = $1', [date], (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (parseInt(result.rows[0].count) >= 50) {
        return res.status(409).json({ error: 'Daily booking limit reached (50 bookings)' });
      }

      // Create booking
      pool.query(
        'INSERT INTO bookings (name, email, phone, purpose, date, time_slot) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
        [name, email, phone, purpose, date, time_slot],
        (err, result) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to create booking' });
          }

          res.status(201).json({
            id: result.rows[0].id,
            message: 'Booking created successfully',
            booking: { name, email, phone, purpose, date, time_slot }
          });
        }
      );
    });
  });
});

// Get all bookings (admin endpoint)
app.get('/api/admin/bookings', (req, res) => {
  const { startDate, endDate } = req.query;
  
  let query = 'SELECT * FROM bookings';
  let params = [];
  
  if (startDate && endDate) {
    query += ' WHERE date BETWEEN ? AND ?';
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

// Export bookings to Excel
app.get('/api/admin/export', (req, res) => {
  const { startDate, endDate } = req.query;
  
  let query = 'SELECT * FROM bookings';
  let params = [];
  
  if (startDate && endDate) {
    query += ' WHERE date BETWEEN ? AND ?';
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
    query += ' WHERE date = ?';
    params = [date];
  }
  
  pool.query(query, params, (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({
      totalBookings: parseInt(result.rows[0].total),
      maxBookings: 50,
      availableBookings: 50 - parseInt(result.rows[0].total)
    });
  });
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  pool.end((err) => {
    if (err) {
      console.error('Error closing database pool:', err);
    } else {
      console.log('Database pool closed.');
    }
    process.exit(0);
  });
}); 