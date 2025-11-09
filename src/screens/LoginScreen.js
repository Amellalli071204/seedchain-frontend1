// src/screens/LoginScreen.js
import React from 'react';
import { useNavigate } from 'react-router-dom'; // <-- ¡LÍNEA CORREGIDA!
// NO importamos el logo aquí

export default function LoginScreen() {
  const navigate = useNavigate();

  const handleSimulatedLogin = (e) => {
    e.preventDefault(); 
    navigate('/seleccionar-rol');
  };

  return (
    <div className="login-container"> 
      
      <h1>SeedChain</h1>
      <p>Tu red de pagos agrícolas 🌽.</p>
      
      <form className="card" onSubmit={handleSimulatedLogin}>
        <h3>Iniciar Sesión</h3>
        <div className="form-group">
          <label>Correo Electrónico</label>
          <input type="email" placeholder="tu@correo.com" />
        </div>
        <div className="form-group">
          <label>Contraseña</label>
          <input type="password" placeholder="••••••••" />
        </div>
        
        <button type="submit" className="button-primary">
          Ingresar 
        </button>
      </form>
    </div>
  );
}