const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
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

// Database setup - try PostgreSQL first, fallback to SQLite
let pool = null;
let db = null;
let usePostgreSQL = false;

// Try PostgreSQL connection first
if (process.env.DATABASE_URL) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  // Test PostgreSQL connection
  pool.query('SELECT NOW()', (err, res) => {
    if (err) {
      console.error('Error connecting to Render PostgreSQL:', err);
      console.error('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
      if (process.env.DATABASE_URL) {
        const maskedUrl = process.env.DATABASE_URL.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
        console.error('DATABASE_URL (masked):', maskedUrl);
      }
      console.log('Falling back to SQLite...');
      initSQLite();
    } else {
      console.log('Connected to Render PostgreSQL database successfully.');
      usePostgreSQL = true;
      initDatabase();
    }
  });
} else {
  console.log('No DATABASE_URL found, using SQLite...');
  initSQLite();
}

// Add error handling for pool
if (pool) {
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
  });
}

// Initialize SQLite database
function initSQLite() {
  db = new sqlite3.Database('./bookings.db', (err) => {
    if (err) {
      console.error('Error opening SQLite database:', err);
      // Try to create the database file if it doesn't exist
      console.log('Attempting to create SQLite database...');
      db = new sqlite3.Database('./bookings.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
          console.error('Failed to create SQLite database:', err);
          process.exit(1);
        } else {
          console.log('Connected to SQLite database.');
          initSQLiteTable();
        }
      });
    } else {
      console.log('Connected to SQLite database.');
      initSQLiteTable();
    }
  });
}

// Initialize SQLite table
function initSQLiteTable() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      purpose TEXT NOT NULL,
      date TEXT NOT NULL,
      time_slot TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `;
  
  db.run(createTableQuery, (err) => {
    if (err) {
      console.error('Error creating SQLite table:', err);
    } else {
      console.log('SQLite bookings table created or already exists.');
    }
  });
}

// Initialize PostgreSQL database tables
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
      console.error('Error creating PostgreSQL table:', err);
    } else {
      console.log('PostgreSQL bookings table created or already exists.');
    }
  });
}

// Validation middleware
const validateBooking = [
  body('name').trim().isLength({ min: 2, max: 255 }).withMessage('Name must be between 2 and 255 characters long').escape(),
  body('email').optional().isEmail().normalizeEmail().withMessage('Must be a valid email').escape(),
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
    database: process.env.DATABASE_URL ? 'Render PostgreSQL Configured' : 'Not configured',
    environment: process.env.NODE_ENV || 'development'
  });
});

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
  if (usePostgreSQL) {
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
  } else {
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
  }
});

// Get overall slot statistics
app.get('/api/slots/status/overall', (req, res) => {
  const today = moment().format('YYYY-MM-DD');
  
  if (usePostgreSQL) {
    // Get today's bookings count
    pool.query('SELECT COUNT(*) as count FROM bookings WHERE date = $1', [today], (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      const totalBookings = parseInt(result.rows[0].count);
      const maxSlots = 18; // 18 slots from 9 AM to 6 PM
      const availableSlots = Math.max(0, maxSlots - totalBookings);
      
      res.json({
        date: today,
        availableSlots,
        totalBookings,
        maxSlots,
        utilizationRate: ((totalBookings / maxSlots) * 100).toFixed(1)
      });
    });
  } else {
    // Get today's bookings count (SQLite)
    db.get('SELECT COUNT(*) as count FROM bookings WHERE date = ?', [today], (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      const totalBookings = row.count;
      const maxSlots = 18; // 18 slots from 9 AM to 6 PM
      const availableSlots = Math.max(0, maxSlots - totalBookings);
      
      res.json({
        date: today,
        availableSlots,
        totalBookings,
        maxSlots,
        utilizationRate: ((totalBookings / maxSlots) * 100).toFixed(1)
      });
    });
  }
});

// Create a new booking
app.post('/api/bookings', validateBooking, (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { name, email, phone, purpose, date, time_slot } = req.body;

  if (usePostgreSQL) {
    // Check if slot is already booked (PostgreSQL)
    pool.query('SELECT id FROM bookings WHERE date = $1 AND time_slot = $2', [date, time_slot], (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (result.rows.length > 0) {
        return res.status(409).json({ error: 'This time slot is already booked' });
      }

      // Check daily booking limit (PostgreSQL)
      pool.query('SELECT COUNT(*) as count FROM bookings WHERE date = $1', [date], (err, result) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (parseInt(result.rows[0].count) >= 50) {
          return res.status(409).json({ error: 'Daily booking limit reached (50 bookings)' });
        }

        // Create booking (PostgreSQL)
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
  } else {
    // Check if slot is already booked (SQLite)
    db.get('SELECT id FROM bookings WHERE date = ? AND time_slot = ?', [date, time_slot], (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (row) {
        return res.status(409).json({ error: 'This time slot is already booked' });
      }

      // Check daily booking limit (SQLite)
      db.get('SELECT COUNT(*) as count FROM bookings WHERE date = ?', [date], (err, row) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (row.count >= 50) {
          return res.status(409).json({ error: 'Daily booking limit reached (50 bookings)' });
        }

        // Create booking (SQLite)
        db.run('INSERT INTO bookings (name, email, phone, purpose, date, time_slot) VALUES (?, ?, ?, ?, ?, ?)', [name, email, phone, purpose, date, time_slot], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to create booking' });
          }
          res.status(201).json({
            id: this.lastID,
            message: 'Booking created successfully',
            booking: { name, email, phone, purpose, date, time_slot }
          });
        });
      });
    });
  }
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
  
  if (usePostgreSQL) {
    pool.query(query, params, (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(result.rows);
    });
  } else {
    // Convert PostgreSQL-style placeholders to SQLite-style
    let sqliteQuery = query.replace(/\$(\d+)/g, '?');
    db.all(sqliteQuery, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    });
  }
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
  
  if (usePostgreSQL) {
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
  } else {
    // Convert PostgreSQL-style placeholders to SQLite-style
    let sqliteQuery = query.replace(/\$(\d+)/g, '?');
    db.all(sqliteQuery, params, (err, rows) => {
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
  }
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
  
  if (usePostgreSQL) {
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
  } else {
    // Convert PostgreSQL-style placeholders to SQLite-style
    let sqliteQuery = query.replace(/\$(\d+)/g, '?');
    db.get(sqliteQuery, params, (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({
        totalBookings: parseInt(row.total),
        maxBookings: 50,
        availableBookings: 50 - parseInt(row.total)
      });
    });
  }
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
  if (usePostgreSQL) {
    pool.end((err) => {
      if (err) {
        console.error('Error closing PostgreSQL database pool:', err);
      } else {
        console.log('PostgreSQL database pool closed.');
      }
    });
  } else {
    db.close((err) => {
      if (err) {
        console.error('Error closing SQLite database:', err);
      } else {
        console.log('SQLite database closed.');
      }
    });
  }
  process.exit(0);
}); 