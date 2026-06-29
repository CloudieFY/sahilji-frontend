import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { StoreProvider } from "@/data/store";
import { Toaster } from "@/components/ui/sonner";
import "./styles.css";

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
      <Toaster />
    </StoreProvider>
  </React.StrictMode>
);