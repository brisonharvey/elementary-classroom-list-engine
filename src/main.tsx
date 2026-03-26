import React from "react"
import ReactDOM from "react-dom/client"
import { AppProvider, STORAGE_KEY } from "./store/AppContext"
import App from "./App"
import { applyReferenceSeedFromLocation } from "./referenceSeed"
import "./App.css"

applyReferenceSeedFromLocation(STORAGE_KEY)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
)
