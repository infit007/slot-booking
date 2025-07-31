import React, { useState, useEffect } from 'react';
import { bookingAPI } from '../services/api';
import { toast } from 'react-hot-toast';
import { Clock, User, Mail, Phone, FileText, CheckCircle } from 'lucide-react';
import moment from 'moment';
import CustomCalendar from './CustomCalendar';
import QRCodeModal from './QRCodeModal';

const BookingInterface = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slotsData, setSlotsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    name: '',
    email: '',
    phone: '',
    purpose: ''
  });
  const [isBooking, setIsBooking] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [bookingConfirmation, setBookingConfirmation] = useState(null);

  // Fetch slots when date changes
  useEffect(() => {
    if (selectedDate) {
      fetchSlots(moment(selectedDate).format('YYYY-MM-DD'));
    }
  }, [selectedDate]);

  const fetchSlots = async (date) => {
    setLoading(true);
    try {
      const response = await bookingAPI.getSlots(date);
      setSlotsData(response.data);
      setSelectedSlot(null); // Reset selected slot when date changes
    } catch (error) {
      toast.error('Failed to fetch available slots');
      console.error('Error fetching slots:', error);
      setSlotsData(null); // Clear data on error
    } finally {
      setLoading(false);
    }
  };

  const handleSlotSelect = (slot) => {
    setSelectedSlot(slot);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setBookingForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedSlot) {
      toast.error('Please select a time slot');
      return;
    }

    // Validate form fields
    if (!bookingForm.name.trim() || !bookingForm.phone.trim() || !bookingForm.purpose.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate email format if provided
    if (bookingForm.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(bookingForm.email)) {
        toast.error('Please enter a valid email address');
        return;
      }
    }

    // Validate phone number
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(bookingForm.phone.replace(/\s/g, ''))) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setIsBooking(true);
    try {
      const bookingData = {
        ...bookingForm,
        date: moment(selectedDate).format('YYYY-MM-DD'),
        time_slot: selectedSlot
      };

      const response = await bookingAPI.createBooking(bookingData);
      toast.success('Booking created successfully!');
      
      // Set booking confirmation data for QR code
      setBookingConfirmation({
        ...bookingData,
        id: response.data.id || Date.now() // Use response ID or fallback
      });
      setShowQRModal(true);
      
      // Reset form
      setBookingForm({
        name: '',
        email: '',
        phone: '',
        purpose: ''
      });
      setSelectedSlot(null);
      
      // Refresh slots
      fetchSlots(moment(selectedDate).format('YYYY-MM-DD'));
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.response?.data?.errors?.[0]?.msg || 'Failed to create booking';
      toast.error(errorMessage);
    } finally {
      setIsBooking(false);
    }
  };

  const isSlotAvailable = (slot) => {
    return slotsData?.availableSlots?.includes(slot);
  };

  const isSlotBooked = (slot) => {
    return slotsData?.bookedSlots?.includes(slot);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Book Your Slot</h2>
        <p className="text-gray-600">Select a date and time slot that works best for you</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Custom Calendar */}
        <div>
          <CustomCalendar
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            minDate={new Date()}
          />
        </div>

        {/* Middle Column - Booking Form */}
        <div className="card">
          <div className="flex items-center mb-4">
            <CheckCircle className="h-5 w-5 text-primary-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Booking Details</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="h-4 w-4 inline mr-1" />
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={bookingForm.name}
                onChange={handleInputChange}
                className="input-field"
                placeholder="Enter your full name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Mail className="h-4 w-4 inline mr-1" />
                Email Address
              </label>
                             <input
                 type="email"
                 name="email"
                 value={bookingForm.email}
                 onChange={handleInputChange}
                 className="input-field"
                 placeholder="Enter your email (optional)"
               />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Phone className="h-4 w-4 inline mr-1" />
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                value={bookingForm.phone}
                onChange={handleInputChange}
                className="input-field"
                placeholder="Enter your phone number"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <FileText className="h-4 w-4 inline mr-1" />
                Purpose of Visit
              </label>
              <textarea
                name="purpose"
                value={bookingForm.purpose}
                onChange={handleInputChange}
                className="input-field"
                rows="3"
                placeholder="Please describe the purpose of your visit"
                required
              />
            </div>

            {selectedSlot && (
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
                <p className="text-sm text-primary-800">
                  <strong>Selected Slot:</strong> {moment(selectedDate).format('MMMM d, YYYY')} at {selectedSlot}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={!selectedSlot || isBooking}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBooking ? 'Creating Booking...' : 'Confirm Booking'}
            </button>
          </form>
        </div>

        {/* Right Column - Time Slots */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-primary-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Available Time Slots</h3>
            </div>
            {slotsData && (
              <div className="text-sm text-gray-500">
                {slotsData.totalBookings}/{slotsData.maxBookings} booked
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : slotsData ? (
            <div className="grid grid-cols-2 gap-2">
              {slotsData.availableSlots.map((slot) => (
                <button
                  key={slot}
                  onClick={() => handleSlotSelect(slot)}
                  className={`p-3 text-sm font-medium rounded-lg border transition-all duration-200 ${
                    selectedSlot === slot
                      ? 'slot-selected'
                      : 'slot-available'
                  }`}
                >
                  {slot}
                </button>
              ))}
              {slotsData.bookedSlots.map((slot) => (
                <div
                  key={slot}
                  className="slot-booked p-3 text-sm font-medium rounded-lg border"
                >
                  {slot}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">Select a date to view available slots</p>
          )}
        </div>
      </div>

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        bookingData={bookingConfirmation}
        isUserView={true}
      />
    </div>
  );
};

export default BookingInterface; 