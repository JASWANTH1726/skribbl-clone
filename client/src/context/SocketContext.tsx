import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '@skribbl/shared';

export type TypedClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface SocketContextValue {
  socket: TypedClientSocket | null;
  isConnected: boolean;
  latency: number | null;
  socketId: string | null;
  error: string | null;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  latency: null,
  socketId: null,
  error: null
});

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<TypedClientSocket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // In dev Vite proxies /socket.io to backend, in prod connects to current host or env
    const socketServerUrl = (import.meta as any).env?.VITE_SERVER_URL || window.location.origin;

    const clientSocket: TypedClientSocket = io(socketServerUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    clientSocket.on('connect', () => {
      setIsConnected(true);
      setSocketId(clientSocket.id || null);
      setError(null);
    });

    clientSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      setSocketId(null);
      if (reason === 'io server disconnect') {
        clientSocket.connect();
      }
    });

    clientSocket.on('connect_error', (err) => {
      setError(err.message || 'Connection error');
      setIsConnected(false);
    });

    setSocket(clientSocket);

    // Heartbeat ping interval
    const pingInterval = setInterval(() => {
      if (clientSocket.connected) {
        const start = Date.now();
        clientSocket.emit('ping_check', start, () => {
          setLatency(Date.now() - start);
        });
      }
    }, 3000);

    return () => {
      clearInterval(pingInterval);
      clientSocket.disconnect();
    };
  }, []);

  const value = useMemo(() => ({
    socket,
    isConnected,
    latency,
    socketId,
    error
  }), [socket, isConnected, latency, socketId, error]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextValue => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
