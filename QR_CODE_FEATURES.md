# QR Code Features Documentation

## Overview
The slot booking application now includes enhanced QR code functionality with company branding, live slot status, and JPEG download capabilities.

## New Features

### 1. Company Name Overlay
- QR codes now display the company name in the center
- Shows "Book your slot" text below the company name
- Configurable through `client/src/config.js`

### 2. Live Slot Status
- Real-time display of available slots: "Slots: X / Y available"
- Updates automatically every 30 seconds
- Manual refresh button available
- Visual progress bar showing slot utilization

### 3. JPEG Download
- Download QR codes in high-quality JPEG format
- Includes company name, slot status, and booking details
- Configurable quality settings (default: 0.9)
- Fallback to PNG if JPEG generation fails

## Configuration

### Company Settings
Edit `client/src/config.js` to customize:

```javascript
export const config = {
  company: {
    name: 'Your Company Name', // Change this to your actual company name
    logo: null, // Add logo URL if available
    website: 'https://yourcompany.com', // Add your website URL
  },
  // ... other settings
};
```

### QR Code Settings
```javascript
qrCode: {
  includeCompanyName: true,
  includeSlotStatus: true,
  imageFormat: 'jpeg', // 'jpeg' or 'png'
  quality: 0.9 // JPEG quality (0.1 to 1.0)
}
```

## API Endpoints

### New Endpoint: `/api/slots/status/overall`
Returns overall slot statistics for the current day:

```json
{
  "date": "2024-01-15",
  "availableSlots": 12,
  "totalBookings": 6,
  "maxSlots": 18,
  "utilizationRate": "33.3"
}
```

## Technical Implementation

### Frontend Changes
- `QRCodeModal.js`: Enhanced with live status and JPEG download
- `config.js`: New configuration file for customization
- `api.js`: Added `getSlotStatus()` method

### Backend Changes
- `server/index.js`: Added `/api/slots/status/overall` endpoint
- Supports both PostgreSQL and SQLite databases

### Features
1. **Real-time Updates**: Slot status updates every 30 seconds
2. **Error Handling**: Graceful fallbacks if API calls fail
3. **Responsive Design**: Works on all screen sizes
4. **High-Quality Images**: JPEG format with configurable quality
5. **Company Branding**: Customizable company name and styling

## Usage

1. Open the QR code modal
2. View live slot status at the bottom
3. Click "Download QR (JPEG)" to save the image
4. The downloaded image includes:
   - QR code with booking data
   - Company name overlay
   - Current slot status
   - Booking details

## Browser Compatibility
- Modern browsers with Canvas API support
- SVG to Canvas conversion for JPEG generation
- Fallback to PNG for older browsers 