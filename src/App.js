// src/App.js
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import LoginScreen from './screens/LoginScreen';
import RoleSelectionScreen from './screens/RoleSelectionScreen';
import DashboardScreen from './screens/DashboardScreen';

// create-react-app ya importa el CSS en index.js, 
// pero importaremos uno para estilos específicos de App
import './App.css'; 

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<LoginScreen />} />
        <Route path="/seleccionar-rol" element={<RoleSelectionScreen />} />
        <Route path="/dashboard/:role" element={<DashboardScreen />} />
      </Routes>
    </div>
  );
}

export default App;