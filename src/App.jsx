import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Certificate from './pages/Certificate.jsx'
import Sealed from './pages/Sealed.jsx'
import Terms from './pages/Terms.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/sealed" element={<Sealed />} />
      <Route path="/m/:seq" element={<Certificate />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
