const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
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

// Database setup
const db = new sqlite3.Database('./bookings.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    initDatabase();
  }
});

// Initialize database tables
function initDatabase() {
  db.run(`CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    purpose TEXT NOT NULL,
    date TEXT NOT NULL,
    time_slot TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Error creating table:', err.message);
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
  db.all('SELECT time_slot FROM bookings WHERE date = ?', [date], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    const bookedSlots = rows.map(row => row.time_slot);
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
  db.get('SELECT id FROM bookings WHERE date = ? AND time_slot = ?', [date, time_slot], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (row) {
      return res.status(409).json({ error: 'This time slot is already booked' });
    }

    // Check daily booking limit
    db.get('SELECT COUNT(*) as count FROM bookings WHERE date = ?', [date], (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (row.count >= 50) {
        return res.status(409).json({ error: 'Daily booking limit reached (50 bookings)' });
      }

      // Create booking
      db.run(
        'INSERT INTO bookings (name, email, phone, purpose, date, time_slot) VALUES (?, ?, ?, ?, ?, ?)',
        [name, email, phone, purpose, date, time_slot],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to create booking' });
          }

          res.status(201).json({
            id: this.lastID,
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
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
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
  
  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    // Transform data for Excel
    const excelData = rows.map(row => ({
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
  
  db.get(query, params, (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({
      totalBookings: row.total,
      maxBookings: 50,
      availableBookings: 50 - row.total
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
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
}); 