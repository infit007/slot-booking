# Slot Booking System

A modern, responsive slot booking website built with React, Node.js, and SQLite. Features a calendar-based UI for selecting date and time slots with real-time availability updates, booking management, and Excel export functionality.

## Features

### 🗓️ Calendar Interface
- Interactive date picker for selecting booking dates
- Real-time slot availability display
- 30-minute time slots from 9 AM to 6 PM
- Visual indicators for available, booked, and selected slots

### 📊 Booking Management
- Daily limit of 50 bookings with real-time updates
- Comprehensive booking form with validation
- User details: Name, Email, Phone, Purpose
- Real-time slot availability checking

### 🔧 Admin Panel
- Complete booking management interface
- Search and filter bookings by date range
- Real-time statistics dashboard
- Excel export functionality for booking data
- Responsive table view with sorting

### 🎨 Modern UI/UX
- Clean, responsive design with Tailwind CSS
- Interactive animations and transitions
- Toast notifications for user feedback
- Mobile-friendly interface
- Professional color scheme and typography

## Tech Stack

### Frontend
- **React 18** - Modern React with hooks
- **Tailwind CSS** - Utility-first CSS framework
- **React DatePicker** - Date selection component
- **React Hot Toast** - Toast notifications
- **Lucide React** - Beautiful icons
- **Axios** - HTTP client

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web framework
- **SQLite3** - Lightweight database
- **XLSX (SheetJS)** - Excel file generation
- **Moment.js** - Date manipulation
- **Express Validator** - Input validation
- **Helmet** - Security headers
- **Morgan** - HTTP request logging

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd slot-booking
   ```

2. **Install all dependencies**
   ```bash
   npm run install-all
   ```

3. **Start the development servers**
   ```bash
   npm run dev
   ```

This will start both the backend server (port 5000) and frontend development server (port 3000).

### Manual Setup (Alternative)

If you prefer to install dependencies separately:

1. **Install root dependencies**
   ```bash
   npm install
   ```

2. **Install backend dependencies**
   ```bash
   cd server
   npm install
   cd ..
   ```

3. **Install frontend dependencies**
   ```bash
   cd client
   npm install
   cd ..
   ```

4. **Start servers**
   ```bash
   # Terminal 1 - Backend
   cd server
   npm run dev
   
   # Terminal 2 - Frontend
   cd client
   npm start
   ```

## Usage

### For Users
1. Navigate to the booking interface
2. Select a date using the calendar
3. Choose an available time slot
4. Fill in your details (Name, Email, Phone, Purpose)
5. Submit the booking

### For Admins
1. Click on the "Admin" tab
2. View booking statistics and manage bookings
3. Use date filters to view specific periods
4. Search bookings by name, email, or purpose
5. Export booking data to Excel format

## API Endpoints

### Public Endpoints
- `GET /api/slots/:date` - Get available slots for a specific date
- `POST /api/bookings` - Create a new booking

### Admin Endpoints
- `GET /api/admin/bookings` - Get all bookings (with optional date filters)
- `GET /api/admin/export` - Export bookings to Excel
- `GET /api/admin/stats` - Get booking statistics

## Database Schema

The application uses SQLite with the following table structure:

```sql
CREATE TABLE bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  purpose TEXT NOT NULL,
  date TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Configuration

### Environment Variables
Create a `.env` file in the server directory:

```env
PORT=5000
NODE_ENV=development
```

### Customization
- **Time slots**: Modify the time generation logic in `server/index.js`
- **Daily limit**: Change the `maxBookings` constant in the server
- **Styling**: Customize Tailwind CSS classes in `client/src/index.css`

## Production Deployment

1. **Build the frontend**
   ```bash
   cd client
   npm run build
   ```

2. **Set environment variables**
   ```bash
   NODE_ENV=production
   PORT=5000
   ```

3. **Start the production server**
   ```bash
   cd server
   npm start
   ```

The server will serve the built React app from the `client/build` directory.

## Features in Detail

### Real-time Slot Availability
- Slots are checked in real-time when users select dates
- Visual indicators show available vs booked slots
- Automatic refresh after successful bookings

### Validation
- Client-side form validation
- Server-side input validation with Express Validator
- Email format validation
- Phone number format validation
- Duplicate booking prevention

### Excel Export
- Exports all booking data to Excel format
- Includes date range filtering
- Automatic filename generation with timestamps
- Proper column headers and formatting

### Responsive Design
- Mobile-first approach
- Responsive grid layouts
- Touch-friendly interface
- Optimized for all screen sizes

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support or questions, please open an issue in the repository. 