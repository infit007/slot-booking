import React from 'react';
import moment from 'moment';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const CustomCalendar = ({ selectedDate, onDateSelect, minDate }) => {
  const [currentMonth, setCurrentMonth] = React.useState(moment());

  const startOfMonth = currentMonth.clone().startOf('month');
  const endOfMonth = currentMonth.clone().endOf('month');
  const startDate = startOfMonth.clone().startOf('week');
  const endDate = endOfMonth.clone().endOf('week');

  const days = [];
  let day = startDate.clone();

  while (day.isSameOrBefore(endDate)) {
    days.push(day.clone());
    day.add(1, 'day');
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const isToday = (date) => moment().isSame(date, 'day');
  const isSelected = (date) => selectedDate && moment(selectedDate).isSame(date, 'day');
  const isCurrentMonth = (date) => date.isSame(currentMonth, 'month');
  const isDisabled = (date) => date.isBefore(moment(), 'day');

  const handleDateClick = (date) => {
    if (!isDisabled(date)) {
      onDateSelect(date.toDate());
    }
  };

  const previousMonth = () => {
    setCurrentMonth(currentMonth.clone().subtract(1, 'month'));
  };

  const nextMonth = () => {
    setCurrentMonth(currentMonth.clone().add(1, 'month'));
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Select Date</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={previousMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
          <span className="text-sm font-medium text-gray-700 min-w-[100px] text-center">
            {currentMonth.format('MMMM YYYY')}
          </span>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
          >
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Week days header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-xs font-medium text-gray-500 text-center py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => (
          <button
            key={index}
            onClick={() => handleDateClick(day)}
            disabled={isDisabled(day)}
            className={`
              relative p-3 text-sm font-medium rounded-lg transition-all duration-200
              ${isDisabled(day)
                ? 'text-gray-300 cursor-not-allowed'
                : isSelected(day)
                ? 'bg-primary-600 text-white shadow-md'
                : isToday(day)
                ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                : isCurrentMonth(day)
                ? 'text-gray-900 hover:bg-gray-100'
                : 'text-gray-400 hover:bg-gray-50'
              }
            `}
          >
            {day.format('D')}
            {isToday(day) && !isSelected(day) && (
              <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-primary-600 rounded-full"></div>
            )}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-center space-x-4 text-xs text-gray-600">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-primary-600 rounded"></div>
            <span>Selected</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-primary-100 rounded"></div>
            <span>Today</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomCalendar; 