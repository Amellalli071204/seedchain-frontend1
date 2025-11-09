// src/OrderContext.js
import React, { createContext, useState, useContext } from 'react';

// 1. Creamos el Context
const OrderContext = createContext(null);

// 2. Creamos un "Proveedor" que envuelve la app
export const OrderProvider = ({ children }) => {
  const [ordenActiva, setOrdenActiva] = useState(null);

  return (
    <OrderContext.Provider value={{ ordenActiva, setOrdenActiva }}>
      {children}
    </OrderContext.Provider>
  );
};

// 3. Creamos un "Hook" para que los componentes usen el context
export const useOrder = () => {
  return useContext(OrderContext);
};