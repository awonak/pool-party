import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';

const initialOptions = {
  "client-id": process.env.REACT_APP_PAYPAL_CLIENT_ID,
  currency: "USD",
  intent: "capture",
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId="138692855602-23a3hc723lcb65qgm08ih48l01vkmuij.apps.googleusercontent.com">
      <PayPalScriptProvider options={initialOptions}>
        <App />
      </PayPalScriptProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);