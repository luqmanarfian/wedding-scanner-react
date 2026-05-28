import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ScannerPage from './pages/ScannerPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/scan" element={<ScannerPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
