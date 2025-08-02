import React, { useState } from 'react';
import BookingInterface from './components/BookingInterface';
import AdminPanel from './components/AdminPanel';
import { Calendar, Settings } from 'lucide-react';

function App() {
  const [currentView, setCurrentView] = useState('booking');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 sm:h-16 md:h-16 lg:h-16">
            <div className="flex items-center">
              <Calendar className="h-8 w-8 sm:h-8 md:h-8 lg:h-8 text-primary-600 mr-2 sm:mr-3" />
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">Slot Booking System</h1>
                <p className="text-xs text-gray-500">by SLOG SOLUTIONS</p>
              </div>
            </div>
            
            <nav className="flex space-x-2 sm:space-x-4">
              <button
                onClick={() => setCurrentView('booking')}
                className={`px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors duration-200 ${
                  currentView === 'booking'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <span className="hidden sm:inline">Book Slot</span>
                <span className="sm:hidden">Book</span>
              </button>
              <button
                onClick={() => setCurrentView('admin')}
                className={`px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors duration-200 flex items-center ${
                  currentView === 'admin'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Settings className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="hidden sm:inline">Admin</span>
                <span className="sm:hidden">Admin</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'booking' ? <BookingInterface /> : <AdminPanel />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-center text-gray-500 text-sm">
            © 2024 SLOG SOLUTIONS. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App; 