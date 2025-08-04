// Configuration file for the slot booking application
export const config = {
  // Company information
  company: {
    name: 'SLOG SOLUTIONS', // Company name for QR codes and display
    logo: null, // Add logo URL if available
    website: 'https://slogsolutions.com', // Add your website URL
  },
  
  // Booking settings
  booking: {
    maxSlotsPerDay: 1200, // Total slots available per day
    timeSlots: [
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
      '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'
    ],
    businessHours: {
      start: '09:00',
      end: '18:00'
    }
  },
  
  // QR Code settings
  qrCode: {
    includeCompanyName: true,
    includeSlotStatus: true,
    imageFormat: 'jpeg', // 'jpeg' or 'png'
    quality: 0.9 // JPEG quality (0.1 to 1.0)
  }
};

export default config; 