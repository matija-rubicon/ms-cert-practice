import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import PasswordGate from "./components/PasswordGate";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <PasswordGate>
        <App />
      </PasswordGate>
    </HashRouter>
  </React.StrictMode>
);
