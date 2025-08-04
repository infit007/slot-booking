import React, { useState, useEffect } from 'react';
import { bookingAPI } from '../services/api';
import { toast } from 'react-hot-toast';
import { Clock, User, Phone, FileText, MapPin, CheckCircle, RefreshCw } from 'lucide-react';
import moment from 'moment';
import CustomCalendar from './CustomCalendar';
import QRCodeModal from './QRCodeModal';
import { config } from '../config';

const BookingInterface = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Add a ref to track the current selectedDate
  const selectedDateRef = React.useRef(selectedDate);
  selectedDateRef.current = selectedDate;
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slotsData, setSlotsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    name: '',
    phone: '',
    purpose: '',
    location: ''
  });
  const [isBooking, setIsBooking] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [bookingConfirmation, setBookingConfirmation] = useState(null);
  const [liveSlotStatus, setLiveSlotStatus] = useState({ available: 0, total: config.booking.maxSlotsPerDay });
  const [isLoadingSlotStatus, setIsLoadingSlotStatus] = useState(false);
  const [weeklyBookingStatus, setWeeklyBookingStatus] = useState(null);
  const [isCheckingWeeklyStatus, setIsCheckingWeeklyStatus] = useState(false);

  // Fetch live slot status
  const fetchLiveSlotStatus = async () => {
    try {
      setIsLoadingSlotStatus(true);
      const selectedDateStr = moment(selectedDate).format('YYYY-MM-DD');
      const response = await bookingAPI.getSlotStatus(selectedDateStr);
      const { availableSlots, maxSlots } = response.data;
      
      setLiveSlotStatus({
        available: availableSlots,
        total: maxSlots
      });
    } catch (error) {
      console.error('Error fetching live slot status:', error);
      // Fallback to default values
      setLiveSlotStatus({ available: 985, total: config.booking.maxSlotsPerDay });
    } finally {
      setIsLoadingSlotStatus(false);
    }
  };

  // Fetch slots when date changes
  useEffect(() => {
    if (selectedDate) {
      fetchSlots(moment(selectedDate).format('YYYY-MM-DD'));
      // Clear selected slot when date changes to prevent stale data
      setSelectedSlot(null);
    }
  }, [selectedDate]);

  // Fetch live slot status on component mount, when date changes, and every 30 seconds
  useEffect(() => {
    if (selectedDate) {
      fetchLiveSlotStatus();
      const interval = setInterval(fetchLiveSlotStatus, 30000); // Update every 30 seconds
      return () => clearInterval(interval);
    }
  }, [selectedDate]);

  // Refresh slots data every 30 seconds to update booking status
  useEffect(() => {
    if (selectedDate) {
      const interval = setInterval(() => {
        fetchSlots(moment(selectedDate).format('YYYY-MM-DD'));
      }, 30000); // Update every 30 seconds
      return () => clearInterval(interval);
    }
  }, [selectedDate]);

  const fetchSlots = async (date) => {
    setLoading(true);
    try {
      const response = await bookingAPI.getSlots(date);
      
      // Ensure allSlots exists, use fixed 10 slots if missing
      let slotsData = response.data;
      if (!slotsData.allSlots || slotsData.allSlots.length === 0) {
        const timeSlots = [
          '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', 
          '12:00', '15:00', '15:30', '16:00'
        ];
        
        slotsData = {
          ...slotsData,
          allSlots: timeSlots
        };
      }
      
      setSlotsData(slotsData);
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
    
    // Check weekly booking status when phone changes
    if (name === 'phone') {
      const phone = value;
      
      if (phone && phone.trim()) {
        checkWeeklyBookingStatus(phone, moment(selectedDate).format('YYYY-MM-DD'));
      } else {
        setWeeklyBookingStatus(null);
      }
    }
  };

  const checkWeeklyBookingStatus = async (phone, date) => {
    if (!phone || !phone.trim()) return;
    
    setIsCheckingWeeklyStatus(true);
    try {
      const response = await bookingAPI.checkWeeklyStatus(phone, date);
      setWeeklyBookingStatus(response.data);
    } catch (error) {
      console.error('Error checking weekly booking status:', error);
      setWeeklyBookingStatus(null);
    } finally {
      setIsCheckingWeeklyStatus(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedSlot) {
      toast.error('Please select a time slot');
      return;
    }

    // Validate form fields
    if (!bookingForm.name.trim() || !bookingForm.phone.trim() || !bookingForm.purpose.trim() || !bookingForm.location.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Validate phone number
    const phoneRegex = /^[+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(bookingForm.phone.replace(/\s/g, ''))) {
      toast.error('Please enter a valid phone number');
      return;
    }

    // Check weekly booking restriction
    try {
      const weeklyStatusResponse = await bookingAPI.checkWeeklyStatus(
        bookingForm.phone,
        moment(selectedDate).format('YYYY-MM-DD')
      );
      
      if (weeklyStatusResponse.data.hasBookedThisWeek) {
        toast.error('You have already booked a slot this week. Only one booking per week is allowed.');
        return;
      }
    } catch (error) {
      console.error('Error checking weekly booking status:', error);
      // Continue with booking attempt - server will validate again
    }

    setIsBooking(true);
    try {
      // Prepare booking data
      const bookingData = {
        name: bookingForm.name,
        phone: bookingForm.phone,
        purpose: bookingForm.purpose,
        location: bookingForm.location,
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
        phone: '',
        purpose: '',
        location: ''
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

  // These functions are available for future use if needed
  // const isSlotAvailable = (slot) => {
  //   return slotsData?.availableSlots?.includes(slot);
  // };

  // const isSlotBooked = (slot) => {
  //   return slotsData?.bookedSlots?.includes(slot);
  // };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Book Your Slot</h2>
        <p className="text-gray-600">Select a date and time slot that works best for you</p>
        
        {/* Live Slot Status */}
        <div className="mt-4 bg-blue-50 rounded-lg p-4 max-w-md mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-blue-900 text-sm">Daily Booking Status</h3>
            <button
              onClick={fetchLiveSlotStatus}
              disabled={isLoadingSlotStatus}
              className="text-blue-600 hover:text-blue-800 transition-colors"
              title="Refresh slot status"
            >
              <RefreshCw className={`h-4 w-4 ${isLoadingSlotStatus ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-green-600">
              {slotsData ? (1200 - slotsData.totalBookings) : liveSlotStatus.available} / {slotsData ? 1200 : liveSlotStatus.total} are available
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${slotsData ? ((1200 - slotsData.totalBookings) / 1200) * 100 : (liveSlotStatus.available / liveSlotStatus.total) * 100}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Updates automatically every 30 seconds
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Custom Calendar */}
        <div className="order-1 lg:order-1">
          <CustomCalendar
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            minDate={new Date()}
          />
        </div>

        {/* Middle Column - Booking Form */}
        <div className="card order-3 lg:order-2">
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
              
              {/* Weekly Booking Status */}
              {isCheckingWeeklyStatus && (
                <div className="mt-2 text-sm text-blue-600">
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    Checking weekly booking status...
                  </div>
                </div>
              )}
              
              {weeklyBookingStatus && !isCheckingWeeklyStatus && (
                <div className={`mt-2 p-2 rounded-md text-sm ${
                  weeklyBookingStatus.hasBookedThisWeek 
                    ? 'bg-red-50 text-red-700 border border-red-200' 
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}>
                  <div className="flex items-center">
                    {weeklyBookingStatus.hasBookedThisWeek ? (
                      <>
                        <span className="text-red-500 mr-1">⚠️</span>
                        <span>You have already booked a slot this week</span>
                      </>
                    ) : (
                      <>
                        <span className="text-green-500 mr-1">✅</span>
                        <span>You can book a slot this week</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <FileText className="h-4 w-4 inline mr-1" />
                Purpose of Visit
              </label>
              <select
                name="purpose"
                value={bookingForm.purpose}
                onChange={handleInputChange}
                className="input-field"
                required
              >
                <option value="" disabled>Select purpose</option>
                <option value="Liquor">Liquor</option>
                <option value="Grocery">Grocery</option>
                <option value="Both">Both (Liquor and Grocery)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <MapPin className="h-4 w-4 inline mr-1" />
                Location
              </label>
              <select
                name="location"
                value={bookingForm.location}
                onChange={handleInputChange}
                className="input-field"
                required
              >
                <option value="" disabled>Select location</option>
                <option value="Almora">Almora</option>
                <option value="Bageshwar">Bageshwar</option>
                <option value="Chamoli">Chamoli</option>
                <option value="Champawat">Champawat</option>
                <option value="Dehradun">Dehradun</option>
                <option value="Haridwar">Haridwar</option>
                <option value="Nainital">Nainital</option>
                <option value="Pauri Garhwal">Pauri Garhwal</option>
                <option value="Pithoragarh">Pithoragarh</option>
                <option value="Rudraprayag">Rudraprayag</option>
                <option value="Tehri Garhwal">Tehri Garhwal</option>
                <option value="Uttarkashi">Uttarkashi</option>
                <option value="Udham Singh Nagar">Udham Singh Nagar</option>
                <option value="Others">Others</option>
              </select>
            </div>

            {selectedSlot && selectedDateRef.current && (
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-4" key={`slot-${selectedDateRef.current.getTime()}-${selectedSlot}`}>
                <p className="text-sm text-primary-800">
                  <strong>Selected Slot:</strong> {selectedDateRef.current.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at {selectedSlot}
                </p>
              </div>
            )}

                         <button
               type="submit"
               disabled={!selectedSlot || isBooking || (weeklyBookingStatus && weeklyBookingStatus.hasBookedThisWeek)}
               className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
             >
               {isBooking ? 'Creating Booking...' : 
                (weeklyBookingStatus && weeklyBookingStatus.hasBookedThisWeek) ? 'Already Booked This Week' : 
                'Confirm Booking'}
             </button>
          </form>
        </div>

        {/* Right Column - Time Slots */}
        <div className="card order-2 lg:order-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-primary-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Available Time Slots</h3>
            </div>
                         {slotsData && (
               <div className="text-sm text-gray-500">
                 {1200 - slotsData.totalBookings}/1200 available • {slotsData.availableSlots.length} slots open
               </div>
             )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : slotsData ? (
                         <div className="grid grid-cols-2 gap-3">
               {(slotsData.slotStatus || []).map((slotInfo) => {
                 const isSelected = selectedSlot === slotInfo.time;
                 const isFullyBooked = slotInfo.isFullyBooked;
                 const isAvailable = slotInfo.isAvailable;
                 

                 
                 if (isFullyBooked) {
                   return (
                     <div
                       key={slotInfo.time}
                       className="slot-booked p-3 text-sm font-medium rounded-lg border flex flex-col items-center justify-center cursor-not-allowed"
                       title="This slot is fully booked"
                     >
                       <span className="font-bold">{slotInfo.time}</span>
                       <span className="text-xs opacity-75">Fully Booked</span>
                       <span className="text-xs opacity-75">0/120 available</span>
                     </div>
                   );
                 } else {
                   return (
                     <button
                       key={slotInfo.time}
                       onClick={() => handleSlotSelect(slotInfo.time)}
                       className={`p-3 text-sm font-medium rounded-lg border transition-all duration-200 flex flex-col items-center justify-center ${
                         isSelected
                           ? 'slot-selected'
                           : 'slot-available'
                       }`}
                       title={`${slotInfo.availableSpots} spots available`}
                     >
                       <span className="font-bold">{slotInfo.time}</span>
                       <span className="text-xs opacity-75">{120 - slotInfo.bookingCount}/120 available</span>
                     </button>
                   );
                 }
               })}
              {(!slotsData.allSlots || slotsData.allSlots.length === 0) && (
                <div className="col-span-2 text-center py-8 text-gray-500">
                  <p>No time slots available for this date.</p>
                  <p className="text-sm mt-1">Please select a different date.</p>
                </div>
              )}
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