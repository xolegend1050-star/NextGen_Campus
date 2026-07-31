import { useState, useEffect } from 'react';
import { getSocket } from '../../utils/socket';

const OnlineIndicator = ({ userId, size = 'sm', showLabel = false }) => {
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleOnlineUsers = (users) => {
      setOnlineUsers(users);
    };

    socket.on('online_users', handleOnlineUsers);

    return () => {
      socket.off('online_users', handleOnlineUsers);
    };
  }, []);

  const isOnline = onlineUsers.includes(userId);

  const sizeClasses = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };

  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={`${sizeClasses[size]} rounded-full ${
          isOnline ? 'bg-green-500' : 'bg-gray-300'
        } ring-2 ring-white`}
      />
      {showLabel && (
        <span className={`text-xs ${isOnline ? 'text-green-600' : 'text-gray-400'}`}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      )}
    </span>
  );
};

export default OnlineIndicator;
