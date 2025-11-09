// src/App.js
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import LoginScreen from './screens/LoginScreen';
import RoleSelectionScreen from './screens/RoleSelectionScreen';
import DashboardScreen from './screens/DashboardScreen';
import './App.css'; 

// NO importamos el logo aquí

function App() {
  return (
    <div className="App">
      {/* BORRAMOS el logo global de aquí */}

      {/* Rutas de la aplicación */}
      <Routes>
        <Route path="/" element={<LoginScreen />} />
        <Route path="/seleccionar-rol" element={<RoleSelectionScreen />} />
        <Route path="/dashboard/:role" element={<DashboardScreen />} />
      </Routes>
    </div>
  );
}

export default App;