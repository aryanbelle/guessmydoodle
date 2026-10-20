import React, { createContext, useContext, useEffect, useMemo } from "react";
import { io } from "socket.io-client";
import { backendUrl } from "./lib/backendUrl";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const socket = useMemo(() => io(backendUrl, {
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    timeout: 10000,
    transports: ["websocket", "polling"],
  }), []);

  useEffect(() => () => socket.disconnect(), [socket]);
  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);
