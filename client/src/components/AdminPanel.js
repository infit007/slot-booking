import React, { useState, useEffect, useCallback } from 'react';
import DatePicker from 'react-datepicker';
import { bookingAPI } from '../services/api';
import { toast } from 'react-hot-toast';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  Users, 
  Clock, 
  Search,
  RefreshCw,
  QrCode,
  Trash2,
  CheckSquare,
  Square,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import moment from 'moment';
import 'react-datepicker/dist/react-datepicker.css';
import QRCodeModal from './QRCodeModal';

const AdminPanel = () => {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Admin panel state
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedBookings, setSelectedBookings] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Default admin credentials
  const DEFAULT_USERNAME = 'Slog_admin';
  const DEFAULT_PASSWORD = 'slog5496@';

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoggingIn(true);
    
    try {
      // Simple authentication check
      if (loginForm.username === DEFAULT_USERNAME && loginForm.password === DEFAULT_PASSWORD) {
        setIsAuthenticated(true);
        toast.success('Login successful!');
        // Store authentication in localStorage for persistence
        localStorage.setItem('adminAuthenticated', 'true');
      } else {
        toast.error('Invalid username or password');
      }
    } catch (error) {
      toast.error('Login failed');
      console.error('Login error:', error);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('adminAuthenticated');
    toast.success('Logged out successfully');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setLoginForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Check if already authenticated on component mount
  useEffect(() => {
    const isAuth = localStorage.getItem('adminAuthenticated') === 'true';
    setIsAuthenticated(isAuth);
  }, []);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const start = startDate ? moment(startDate).format('YYYY-MM-DD') : null;
      const end = endDate ? moment(endDate).format('YYYY-MM-DD') : null;
      
      const response = await bookingAPI.getAllBookings(start, end);
      setBookings(response.data);
    } catch (error) {
      toast.error('Failed to fetch bookings');
      console.error('Error fetching bookings:', error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchBookings();
      fetchStats();
    }
  }, [fetchBookings, isAuthenticated]);

  const fetchStats = async () => {
    try {
      const response = await bookingAPI.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleExport = async () => { 
    try {
      const start = startDate ? moment(startDate).format('YYYY-MM-DD') : null;
      const end = endDate ? moment(endDate).format('YYYY-MM-DD') : null;
         
      const response = await bookingAPI.exportBookings(start, end);
       
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `bookings_${start || 'all'}_${end || 'all'}_${moment().format('YYYY-MM-DD_HH-mm')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Bookings exported successfully!');
    } catch (error) {
      toast.error('Failed to export bookings');
      console.error('Error exporting bookings:', error);
    }
  };

  const filteredBookings = bookings.filter(booking =>
    booking.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    booking.purpose.toLowerCase().includes(searchTerm.toLowerCase()) ||
    booking.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const clearFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setSearchTerm('');
  };

  const handleShowQRCode = (booking) => {
    setSelectedBooking(booking);
    setShowQRModal(true);
  };

  const handleSelectBooking = (bookingId) => {
    setSelectedBookings(prev => 
      prev.includes(bookingId) 
        ? prev.filter(id => id !== bookingId)
        : [...prev, bookingId]
    );
  };

  const handleSelectAll = () => {
    if (selectedBookings.length === filteredBookings.length) {
      setSelectedBookings([]);
    } else {
      setSelectedBookings(filteredBookings.map(booking => booking.id));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedBookings.length === 0) {
      toast.error('Please select bookings to delete');
      return;
    }

    const confirmMessage = selectedBookings.length === 1 
      ? 'Are you sure you want to delete this booking?' 
      : `Are you sure you want to delete ${selectedBookings.length} bookings? This action cannot be undone.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await bookingAPI.deleteMultipleBookings(selectedBookings);
      toast.success(response.data.message);
      setSelectedBookings([]);
      fetchBookings();
      fetchStats();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to delete bookings';
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSingle = async (bookingId, bookingName) => {
    if (!window.confirm(`Are you sure you want to delete the booking for "${bookingName}"?`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await bookingAPI.deleteBooking(bookingId);
      toast.success(response.data.message);
      fetchBookings();
      fetchStats();
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Failed to delete booking';
      toast.error(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  // Login Form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 bg-primary-600 rounded-full flex items-center justify-center">
              <Lock className="h-6 w-6 text-white" />
            </div>
            <h2 className="mt-6 text-3xl font-bold text-gray-900">SLOG SOLUTIONS</h2>
            <h3 className="mt-2 text-xl font-semibold text-gray-700">Admin Login</h3>
            <p className="mt-2 text-sm text-gray-600">Enter your credentials to access the admin panel</p>
          </div>
          
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                  Username
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={loginForm.username}
                  onChange={handleInputChange}
                  className="mt-1 input-field"
                  placeholder="Enter username"
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <div className="mt-1 relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={loginForm.password}
                    onChange={handleInputChange}
                    className="input-field pr-10"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoggingIn}
                className="btn-primary w-full flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoggingIn ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Logging in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    );
  }

  // Admin Dashboard
  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">SLOG SOLUTIONS</h2>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">Admin Dashboard</h3>
        <p className="text-gray-600">Manage bookings and view statistics</p>
        <button
          onClick={handleLogout}
          className="mt-4 btn-secondary text-sm"
        >
          Logout
        </button>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Bookings</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalBookings}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Available Slots</p>
                <p className="text-2xl font-bold text-gray-900">{stats.availableBookings}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Daily Limit</p>
                <p className="text-2xl font-bold text-gray-900">{stats.maxBookings}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Actions */}
      <div className="card mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <DatePicker
                selected={startDate}
                onChange={(date) => setStartDate(date)}
                dateFormat="yyyy-MM-dd"
                className="input-field"
                placeholderText="Select start date"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <DatePicker
                selected={endDate}
                onChange={(date) => setEndDate(date)}
                dateFormat="yyyy-MM-dd"
                className="input-field"
                placeholderText="Select end date"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={clearFilters}
              className="btn-secondary"
            >
              Clear Filters
            </button>
            <button
              onClick={handleExport}
              className="btn-primary flex items-center"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="flex items-center">
          <Search className="h-5 w-5 text-gray-400 mr-3" />
          <input
            type="text"
                         placeholder="Search by name, purpose, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field flex-1"
          />
          <button
            onClick={fetchBookings}
            className="btn-secondary ml-2 flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </button>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Bookings</h3>
          <div className="flex items-center gap-4">
            {selectedBookings.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">
                  {selectedBookings.length} selected
                </span>
                <button
                  onClick={handleDeleteSelected}
                  disabled={isDeleting}
                  className="btn-danger flex items-center text-sm"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  {isDeleting ? 'Deleting...' : `Delete Selected`}
                </button>
              </div>
            )}
            <span className="text-sm text-gray-500">
              {filteredBookings.length} booking{filteredBookings.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : filteredBookings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button
                      onClick={handleSelectAll}
                      className="flex items-center hover:text-gray-700 transition-colors"
                    >
                      {selectedBookings.length === filteredBookings.length && filteredBookings.length > 0 ? (
                        <CheckSquare className="h-4 w-4" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                                     <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Name
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Phone
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Date & Time
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Purpose
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Created
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Location
                   </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                                 {filteredBookings.map((booking) => (
                   <tr 
                     key={booking.id} 
                     className="hover:bg-gray-50"
                   >
                     <td className="px-6 py-4 whitespace-nowrap">
                       <button
                         onClick={() => handleSelectBooking(booking.id)}
                         className="flex items-center hover:text-gray-700 transition-colors"
                       >
                         {selectedBookings.includes(booking.id) ? (
                           <CheckSquare className="h-4 w-4" />
                         ) : (
                           <Square className="h-4 w-4" />
                         )}
                       </button>
                     </td>
                                           <td 
                        className="px-6 py-4 whitespace-nowrap cursor-pointer"
                        onClick={() => handleShowQRCode(booking)}
                      >
                        <div className="text-sm font-medium text-gray-900">{booking.name}</div>
                      </td>
                      <td 
                        className="px-6 py-4 whitespace-nowrap cursor-pointer"
                        onClick={() => handleShowQRCode(booking)}
                      >
                        <div className="text-sm text-gray-900">{booking.phone}</div>
                      </td>
                      <td 
                        className="px-6 py-4 whitespace-nowrap cursor-pointer"
                        onClick={() => handleShowQRCode(booking)}
                      >
                        <div className="text-sm text-gray-900">
                          {moment(booking.date).format('MMM D, YYYY')}
                        </div>
                        <div className="text-sm text-gray-500">{booking.time_slot}</div>
                      </td>
                      <td 
                        className="px-6 py-4 cursor-pointer"
                        onClick={() => handleShowQRCode(booking)}
                      >
                        <div className="text-sm text-gray-900 max-w-xs truncate">
                          {booking.purpose}
                        </div>
                      </td>
                      <td 
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                        onClick={() => handleShowQRCode(booking)}
                      >
                        {moment(booking.created_at).format('MMM D, YYYY HH:mm')}
                      </td>
                      <td 
                        className="px-6 py-4 whitespace-nowrap cursor-pointer"
                        onClick={() => handleShowQRCode(booking)}
                      >
                        <div className="text-sm text-gray-900">{booking.location}</div>
                      </td>
                     <td className="px-6 py-4 whitespace-nowrap">
                       <div className="flex items-center gap-2">
                         <button
                           onClick={() => handleShowQRCode(booking)}
                           className="text-primary-600 hover:text-primary-800 transition-colors"
                           title="View QR Code"
                         >
                           <QrCode className="h-5 w-5" />
                         </button>
                         <button
                           onClick={() => handleDeleteSingle(booking.id, booking.name)}
                           disabled={isDeleting}
                           className="text-red-600 hover:text-red-800 transition-colors"
                           title="Delete Booking"
                         >
                           <Trash2 className="h-5 w-5" />
                         </button>
                       </div>
                     </td>
                   </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No bookings found</p>
          </div>
                 )}
       </div>

       {/* QR Code Modal */}
       <QRCodeModal
         isOpen={showQRModal}
         onClose={() => setShowQRModal(false)}
         bookingData={selectedBooking}
         isUserView={false}
       />
     </div>
   );
 };

export default AdminPanel; 