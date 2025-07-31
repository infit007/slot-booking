import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Download, CheckCircle } from 'lucide-react';
import moment from 'moment';

const QRCodeModal = ({ isOpen, onClose, bookingData, isUserView = false }) => {
  if (!isOpen || !bookingData) return null;

  // Create QR code data string
  const qrData = JSON.stringify({
    name: bookingData.name,
    email: bookingData.email || '',
    phone: bookingData.phone,
    date: bookingData.date,
    time_slot: bookingData.time_slot,
    purpose: bookingData.purpose,
    booking_id: bookingData.id || 'pending'
  });

  const handleDownload = () => {
    const canvas = document.querySelector('#qr-code-canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = `booking-qr-${bookingData.name}-${moment(bookingData.date).format('YYYY-MM-DD')}.png`;
      link.href = canvas.toDataURL();
      link.click();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 relative">
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

        {/* QR Code */}
        <div className="flex justify-center mb-6">
          <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
            <QRCodeSVG
              id="qr-code-canvas"
              value={qrData}
              size={200}
              level="M"
              includeMargin={true}
            />
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
              <span className="text-gray-600">Email:</span>
              <span className="font-medium">{bookingData.email || 'Not provided'}</span>
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
        <div className="flex gap-3">
          <button
            onClick={handleDownload}
            className="btn-secondary flex-1 flex items-center justify-center"
          >
            <Download className="h-4 w-4 mr-2" />
            Download QR
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