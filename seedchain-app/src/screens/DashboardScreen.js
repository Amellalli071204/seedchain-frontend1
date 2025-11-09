// src/screens/DashboardScreen.js
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useOrder } from '../OrderContext'; 
import logo from '../assets/logo.jpg'; 

// --- (Base de Datos Fija - sin cambios) ---
const PRODUCTOS_BASE = [
  { id: 'aguacate', nombre: 'Aguacate Hass', precio: 50000, unidad: 'tn' },
  { id: 'tomate', nombre: 'Tomate Saladette', precio: 30000, unidad: 'tn' },
  { id: 'lechuga', nombre: 'Lechuga Romana', precio: 15000, unidad: 'tn' },
  { id: 'cebolla', nombre: 'Cebolla Blanca', precio: 25000, unidad: 'tn' },
  { id: 'chile', nombre: 'Chile Serrano', precio: 40000, unidad: 'tn' },
];

// --- Panel del Agricultor ---
const FarmerDashboard = () => {
  const { ordenActiva } = useOrder();
  return (
    // ¡CAMBIO! Se quitó la clase "farmer-dashboard"
    <div className="dashboard-content"> 
      <h2>Panel del Agricultor 🌾</h2>
      <p>Aquí administras tus productos y ves tus comprobantes de pago.</p>
      <div className="product-list">
        <h3>Mis Productos Publicados</h3>
        {PRODUCTOS_BASE.map(p => (
          <div className="product-item" key={p.id}>
            <span>{p.nombre}</span>
            <span className="price">${p.precio} / {p.unidad}</span>
          </div>
        ))}
      </div>
      {ordenActiva && (
        <div className="order-summary-card" style={{marginTop: '20px'}}>
          <h3 className="comprobante">¡Venta Realizada! (Comprobante)</h3>
          <p className="item"><span>{ordenActiva.cantidad} {ordenActiva.producto.unidad}(s) de {ordenActiva.producto.nombre}</span> <span className="price">${ordenActiva.subtotal.toFixed(2)}</span></p>
          <p className="total"><span>Tu pago a recibir (neto):</span> <span className="price-total">${ordenActiva.subtotal.toFixed(2)}</span></p>
          <small>El cliente también pagó ${ordenActiva.pagoTransportista.toFixed(2)} al transportista.</small>
        </div>
      )}
    </div>
  );
};

// --- Panel del Cliente (Comprador) (sin cambios) ---
const BuyerDashboard = () => {
  const { ordenActiva, setOrdenActiva } = useOrder(); 
  const [selectedProductId, setSelectedProductId] = useState(''); 
  const [cantidad, setCantidad] = useState(''); 
  const [estadoDestino, setEstadoDestino] = useState(''); 
  const handleGenerarOrden = () => {
    if (!selectedProductId || !estadoDestino || !cantidad) {
      alert('Por favor, completa todos los campos para generar la orden.');
      return;
    }
    if (selectedProductId !== 'aguacate') {
      alert('DEMO: Por el momento, solo la orden de Aguacate está habilitada para este cascarón.');
      return;
    }
    const producto = PRODUCTOS_BASE.find(p => p.id === selectedProductId);
    const numCantidad = Number(cantidad); 
    if (!producto || numCantidad <= 0) {
      alert("La cantidad debe ser un número mayor a cero.");
      return;
    }
    const subtotal = producto.precio * numCantidad;
    const pagoTransportista = subtotal * 0.20; 
    const totalPagar = subtotal + pagoTransportista;
    const nuevaOrden = {
      id: `orden-${Date.now()}`,
      producto: producto,
      cantidad: numCantidad, 
      subtotal: subtotal,
      pagoTransportista: pagoTransportista,
      totalPagar: totalPagar,
      destino: estadoDestino,
    };
    setOrdenActiva(nuevaOrden);
  };
  return (
    <div className="dashboard-content">
      <h2>Panel del Cliente 🏭</h2>
      <p>Selecciona productos del agricultor para generar una orden de pago.</p>
      <div className="form-group">
        <label>Selecciona un Producto:</label>
        <select 
          value={selectedProductId} 
          onChange={(e) => setSelectedProductId(e.target.value)}
        >
          <option value="" disabled>Elige un producto...</option>
          {PRODUCTOS_BASE.map(p => (
            <option key={p.id} value={p.id}>
              {p.nombre} (${p.precio} / {p.unidad})
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Cantidad (en toneladas):</label>
        <input 
          type="number"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)} 
          placeholder="Ej. 2" 
        />
      </div>
      <div className="form-group">
        <label>Enviar Pedido a (Estado):</label>
        <select value={estadoDestino} onChange={(e) => setEstadoDestino(e.target.value)}>
          <option value="" disabled>Elige un estado...</option>
          <option value="michoacan">Michoacán</option>
          <option value="jalisco">Jalisco</option>
          <option value="cdmx">Ciudad de México</option>
          <option value="nuevo_leon">Nuevo León</option>
          <option value="veracruz">Veracruz</option>
        </select>
      </div>
      <button onClick={handleGenerarOrden} className="button-primary">
        Generar Orden de Pedido
      </button>
      {ordenActiva && (
        <div className="order-summary-card">
          <h3>Orden de Pedido</h3>
          <p className="item">
            <span>{ordenActiva.cantidad} {ordenActiva.producto.unidad}(s) de {ordenActiva.producto.nombre}</span>
            <span className="price">${ordenActiva.subtotal.toFixed(2)}</span>
          </p>
          <p className="item secondary">
            <span>+ Pago Transportista (20%)</span>
            <span className="price">${ordenActiva.pagoTransportista.toFixed(2)}</span>
          </p>
          <p className="item secondary">
            <span>Destino:</span>
            <span style={{fontWeight: 600, textTransform: 'capitalize'}}>{ordenActiva.destino}</span>
          </p>
          <hr />
          <p className="total">
            <span>Total a Pagar:</span>
            <span className="price-total">${ordenActiva.totalPagar.toFixed(2)}</span>
          </p>
          <div className="payment-action">
            <button 
              className="button-primary" 
              onClick={() => alert('Próximamente: Conexión con API de OpenPayments (Backend)')}
            >
              Pagar Ahora
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Panel del Transportista (sin cambios) ---
const TransporterDashboard = () => {
  const { ordenActiva } = useOrder();
  return (
    <div className="dashboard-content">
      <h2>Panel del Transportista 🚚</h2>
      <p>Aquí puedes ver tus viajes asignados y tus ganancias.</p>
      {ordenActiva ? (
        <div className="order-summary-card">
          <h3>Viaje Asignado</h3>
          <p>Debes transportar lo siguiente:</p>
          <p className="item">
            <span>{ordenActiva.cantidad} {ordenActiva.producto.unidad}(s) de {ordenActiva.producto.nombre}</span>
          </p>
          <p className="item secondary" style={{fontSize: '1.1em'}}>
            <span>Destino del Viaje:</span>
            <strong style={{textTransform: 'capitalize'}}>{ordenActiva.destino}</strong>
          </p>
          <hr />
          <p className="total">
            <span>Tu Pago Total (Ganancia):</span>
            <span className="price-total">${ordenActiva.pagoTransportista.toFixed(2)}</span>
          </p>
        </div>
      ) : (
        <p>No tienes viajes asignados por el momento.</p>
      )}
    </div>
  );
};


// --- Componente Principal del Dashboard ---
export default function DashboardScreen() {
  const { role } = useParams();
  const renderRoleDashboard = () => {
    switch (role) {
      case 'agricultor':
        return <FarmerDashboard />;
      case 'cliente':
        return <BuyerDashboard />;
      case 'transportista':
        return <TransporterDashboard />;
      default:
        return <p>Error: Rol no reconocido.</p>;
    }
  };

  return (
    <div className="container">
      <nav className="navbar">
        <div className="navbar-brand">
          <img src={logo} alt="SeedChain" className="navbar-logo" />
          <strong>SeedChain</strong>
        </div>
        <span className="navbar-role">Rol: {role}</span> 
        <Link to="/">(Salir)</Link>
      </nav>
      
      <div className="card">
        {renderRoleDashboard()}
      </div>
    </div>
  );
}