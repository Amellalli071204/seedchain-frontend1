// src/screens/RoleSelectionScreen.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// NO importamos el logo aquí

export default function RoleSelectionScreen() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState(''); 

  const handleRegistration = () => {
    if (!selectedRole) {
      alert('Por favor, selecciona un rol');
      return;
    }
    console.log('Registrando al usuario como:', selectedRole);
    navigate(`/dashboard/${selectedRole}`);
  };

  return (
    <div className="login-container">

      {/* QUITAMOS el div .login-header y el logo de aquí */}

      <div className="card">
        <h2>Completa tu registro</h2>
        <p>Para continuar, necesitamos saber qué tipo de usuario eres.</p>
        
        <div className="form-group">
          <label htmlFor="role-select">Selecciona tu rol:</label>
          <select 
            id="role-select"
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
          >
            <option value="" disabled>Elige un rol...</option>
            <option value="agricultor">Soy Agricultor 🌾</option>
            <option value="cliente">Soy Cliente / Comprador 🏭</option>
            <option value="transportista">Soy Transportista 🚚</option>
          </select>
        </div>
        
        <button onClick={handleRegistration} className="button-primary">
          Continuar
        </button>
      </div>
    </div>
  );
}