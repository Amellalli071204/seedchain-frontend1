// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // <-- IMPORTA ESTO
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    {/*
      AQUÍ ESTÁ LA MAGIA: 
      Envolvemos la App con el Router aquí
    */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);