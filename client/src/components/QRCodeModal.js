import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Download, CheckCircle, RefreshCw } from 'lucide-react';
import moment from 'moment';
import { bookingAPI } from '../services/api';
import { config } from '../config';

const QRCodeModal = ({ isOpen, onClose, bookingData, isUserView = false }) => {
  const [slotStatus, setSlotStatus] = useState({ available: 0, total: config.booking.maxSlotsPerDay });
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

    // Fetch slot status
  const fetchSlotStatus = async () => {
    try {
      setIsLoading(true);
      const selectedDateStr = moment(bookingData.date).format('YYYY-MM-DD');
      const response = await bookingAPI.getSlotStatus(selectedDateStr);
      const { availableSlots, maxSlots } = response.data;
      
      setSlotStatus({
        available: availableSlots,
        total: maxSlots
      });
    } catch (error) {
      console.error('Error fetching slot status:', error);
      // Fallback to default values
      setSlotStatus({ available: 985, total: config.booking.maxSlotsPerDay });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch slot status on component mount and every 30 seconds
  useEffect(() => {
    if (isOpen) {
      fetchSlotStatus();
      const interval = setInterval(fetchSlotStatus, 30000); // Update every 30 seconds
      return () => clearInterval(interval);
    }
  }, [isOpen]);

  // Early return after all hooks
  if (!isOpen || !bookingData) return null;

  // Create QR code data string (after null check)
  const qrData = JSON.stringify({
    booking_id: bookingData.id || 'pending',
    name: bookingData.name,
    phone: bookingData.phone,
    date: bookingData.date,
    time_slot: bookingData.time_slot,
    purpose: bookingData.purpose,
    location: bookingData.location,
    created_at: bookingData.created_at || new Date().toISOString(),
    company: config.company.name,
    qr_generated_at: new Date().toISOString(),
    booking_status: 'confirmed'
  }, null, 2); // Pretty print JSON with 2-space indentation

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      // Create a high-resolution canvas element
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Increase resolution by 3x for better quality
      const scale = 3;
      canvas.width = 400 * scale;
      canvas.height = 500 * scale;
      
      // Scale the context to match the high resolution
      ctx.scale(scale, scale);

      // Set background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Get QR code SVG and convert to canvas
      const qrSvg = document.querySelector('#qr-code-svg');
      if (qrSvg) {
        const svgData = new XMLSerializer().serializeToString(qrSvg);
        const img = new Image();
        
        img.onload = () => {
          // Draw QR code
          ctx.drawImage(img, 100, 50, 200, 200);

                                // Add company name overlay
            ctx.fillStyle = '#1f2937';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(config.company.name, 200, 280);
 
           // Add "Book your slot" text
           ctx.fillStyle = '#6b7280';
           ctx.font = '14px Arial';
           ctx.fillText('Book your slot', 200, 300);
 
           // Add slot status
           ctx.fillStyle = '#059669';
           ctx.font = 'bold 18px Arial';
           ctx.fillText(`Slots: ${slotStatus.available} / ${slotStatus.total} available`, 200, 330);

                     // Add booking details
           ctx.fillStyle = '#374151';
           ctx.font = '12px Arial';
           ctx.textAlign = 'left';
           ctx.fillText(`Name: ${bookingData.name}`, 50, 370);
           ctx.fillText(`Date: ${moment(bookingData.date).format('MMMM D, YYYY')}`, 50, 385);
           ctx.fillText(`Time: ${bookingData.time_slot}`, 50, 400);
           ctx.fillText(`Purpose: ${bookingData.purpose}`, 50, 415);
           ctx.fillText(`Location: ${bookingData.location}`, 50, 430);

                                                               // Download the high-resolution image
           const link = document.createElement('a');
           link.download = `booking-qr-${bookingData.name}-${moment(bookingData.date).format('YYYY-MM-DD')}.jpg`;
           link.href = canvas.toDataURL('image/jpeg', 0.95); // Increased quality to 95%
           link.click();
           setIsDownloading(false);
        };

        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
        
        // Add error handling for image loading
        img.onerror = () => {
          console.error('Failed to load QR code SVG');
                  // Fallback to original download method
        const canvas = document.querySelector('#qr-code-canvas');
        if (canvas) {
          const link = document.createElement('a');
          link.download = `booking-qr-${bookingData.name}-${moment(bookingData.date).format('YYYY-MM-DD')}.png`;
          link.href = canvas.toDataURL();
          link.click();
        }
        setIsDownloading(false);
        };
      }
    } catch (error) {
      console.error('Error generating QR code image:', error);
      // Fallback to original download method
      const canvas = document.querySelector('#qr-code-canvas');
      if (canvas) {
        const link = document.createElement('a');
        link.download = `booking-qr-${bookingData.name}-${moment(bookingData.date).format('YYYY-MM-DD')}.png`;
        link.href = canvas.toDataURL();
        link.click();
      }
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-4 sm:p-6 relative max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          {isUserView ? (
            <>
              <div className="flex justify-center mb-3">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Booking Confirmed!</h2>
              <p className="text-gray-600">Your booking has been successfully created</p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Booking QR Code</h2>
              <p className="text-gray-600">Scan to view booking details</p>
            </>
          )}
        </div>

        {/* QR Code with Company Name Overlay */}
        <div className="flex justify-center mb-6">
          <div className="bg-white p-2 sm:p-4 rounded-lg border-2 border-gray-200 relative">
                         <QRCodeSVG
               id="qr-code-svg"
               value={qrData}
               size={250}
               level="H"
               includeMargin={true}
               className="sm:w-[300px] sm:h-[300px] w-[250px] h-[250px]"
             />
                         {/* Company name overlay */}
             <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
               <div className="bg-white bg-opacity-90 px-2 py-1 rounded">
                 <p className="text-sm font-bold text-gray-800">{config.company.name}</p>
                 <p className="text-xs text-gray-600">Book your slot</p>
               </div>
             </div>
          </div>
        </div>

        {/* Live Slot Status */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-blue-900">Live Slot Status</h3>
            <button
              onClick={fetchSlotStatus}
              disabled={isLoading}
              className="text-blue-600 hover:text-blue-800 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="mt-2">
            <p className="text-lg font-bold text-green-600">
              Slots: {slotStatus.available} / {slotStatus.total} available
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(slotStatus.available / slotStatus.total) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Booking Details */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Booking Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Name:</span>
              <span className="font-medium">{bookingData.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Location:</span>
              <span className="font-medium">{bookingData.location}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Phone:</span>
              <span className="font-medium">{bookingData.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Date:</span>
              <span className="font-medium">{moment(bookingData.date).format('MMMM D, YYYY')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Time:</span>
              <span className="font-medium">{bookingData.time_slot}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Purpose:</span>
              <span className="font-medium max-w-xs truncate">{bookingData.purpose}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className="btn-secondary flex-1 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download QR (JPEG)
              </>
            )}
          </button>
          {isUserView && (
            <button
              onClick={onClose}
              className="btn-primary flex-1"
            >
              Done
            </button>
          )}
        </div>

        {/* Instructions for user view */}
        {isUserView && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Important:</strong> Please save this QR code. You may need to show it when you arrive for your appointment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default QRCodeModal; 