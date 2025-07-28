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
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      <PayPalScriptProvider options={initialOptions}>
        <App />
      </PayPalScriptProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);