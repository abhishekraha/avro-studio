import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

export function App() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
        Avro Studio
      </h1>
      <p className="text-gray-400">
        Visual schema designer and manager
      </p>
    </div>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
