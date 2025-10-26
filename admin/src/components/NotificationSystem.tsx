import React, { useState, useEffect } from 'react';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp: Date;
}

const NotificationSystem: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Function to add a new notification
  const addNotification = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    const newNotification: Notification = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      message,
      type,
      timestamp: new Date()
    };
    
    setNotifications(prev => [newNotification, ...prev]);
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      removeNotification(newNotification.id);
    }, 5000);
  };

  // Function to remove a notification
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  // Function to clear all notifications
  const clearAllNotifications = () => {
    setNotifications([]);
  };

  // Get icon and color based on notification type
  const getNotificationStyle = (type: string) => {
    switch (type) {
      case 'success':
        return {
          icon: (
            <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ),
          bgColor: 'bg-green-50',
          borderColor: 'border-green-400',
          textColor: 'text-green-800'
        };
      case 'error':
        return {
          icon: (
            <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          ),
          bgColor: 'bg-red-50',
          borderColor: 'border-red-400',
          textColor: 'text-red-800'
        };
      case 'warning':
        return {
          icon: (
            <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          ),
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-400',
          textColor: 'text-yellow-800'
        };
      default:
        return {
          icon: (
            <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          ),
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-400',
          textColor: 'text-blue-800'
        };
    }
  };

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-4 left-4 z-50 w-full max-w-sm">
      <div className="space-y-2">
        {notifications.map((notification) => {
          const style = getNotificationStyle(notification.type);
          return (
            <div 
              key={notification.id} 
              className={`rounded-md border-l-4 p-4 shadow-lg ${style.bgColor} ${style.borderColor}`}
            >
              <div className="flex">
                <div className="flex-shrink-0">
                  {style.icon}
                </div>
                <div className="mr-3 w-0 flex-1">
                  <p className={`text-sm font-medium ${style.textColor}`}>
                    {notification.title}
                  </p>
                  <p className={`mt-1 text-sm ${style.textColor}`}>
                    {notification.message}
                  </p>
                </div>
                <div className="ml-4 flex flex-shrink-0">
                  <button
                    className="inline-flex text-gray-400 hover:text-gray-500"
                    onClick={() => removeNotification(notification.id)}
                  >
                    <span className="sr-only">إغلاق</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NotificationSystem;