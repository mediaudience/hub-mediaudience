import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ClienteActivoProvider } from "./context/ClienteActivoContext.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ClienteActivoProvider>
          <App />
        </ClienteActivoProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
