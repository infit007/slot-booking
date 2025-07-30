import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log('API Request:', config.method?.toUpperCase(), config.url);
    return config;
  },
  (error) => {
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
    return Promise.reject(error);
  }
);

export const bookingAPI = {
  // Get available slots for a specific date
  getSlots: (date) => api.get(`/slots/${date}`),
  
  // Create a new booking
  createBooking: (bookingData) => api.post('/bookings', bookingData),
  
  // Get all bookings (admin)
  getAllBookings: (startDate, endDate) => {
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    return api.get('/admin/bookings', { params });
  },
  
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