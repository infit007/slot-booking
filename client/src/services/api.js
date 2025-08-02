import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

// Validate API URL
if (!API_BASE_URL) {
  console.error('API_BASE_URL is not configured');
}

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    
    // Handle specific error cases
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout');
    } else if (error.response?.status === 404) {
      console.error('API endpoint not found');
    } else if (error.response?.status >= 500) {
      console.error('Server error');
    }
    
    return Promise.reject(error);
  }
);

export const bookingAPI = {
  // Get available slots for a specific date
  getSlots: (date) => api.get(`/slots/${date}`),
  
  // Get overall slot status
  getSlotStatus: (date) => {
    const params = {};
    if (date) params.date = date;
    return api.get('/slots/status/overall', { params });
  },
  
  // Check weekly booking status
  checkWeeklyStatus: (phone, date) => {
    const params = { phone };
    if (date) params.date = date;
    return api.get('/user/weekly-status', { params });
  },
  
  // Create a new booking
  createBooking: (bookingData) => api.post('/bookings', bookingData),
  
  // Get all bookings (admin)
  getAllBookings: (startDate, endDate) => {
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return api.get('/admin/bookings', { params });
  },
  
  // Delete a single booking (admin)
  deleteBooking: (id) => api.delete(`/admin/bookings/${id}`),
  
  // Delete multiple bookings (admin)
  deleteMultipleBookings: (ids) => api.delete('/admin/bookings', { data: { ids } }),
  
  // Export bookings to Excel
  exportBookings: (startDate, endDate) => {
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return api.get('/admin/export', { 
      params,
      responseType: 'blob'
    });
  },
  
  // Get booking statistics
  getStats: (date) => {
    const params = {};
    if (date) params.date = date;
    return api.get('/admin/stats', { params });
  },
};

export default api; 