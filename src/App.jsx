import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Certificate from './pages/Certificate.jsx'
import Sealed from './pages/Sealed.jsx'
import Terms from './pages/Terms.jsx'
import GiftBuy from './pages/GiftBuy.jsx'
import Gifted from './pages/Gifted.jsx'
import Redeem from './pages/Redeem.jsx'
import GiftCard from './pages/GiftCard.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/sealed" element={<Sealed />} />
      <Route path="/m/:seq" element={<Certificate />} />
      <Route path="/terms" element={<Terms />} />

      {/* Gifts. /g/:token is the redemption link that appears in emails and on printed cards, so
          it is kept short and must never change shape — a link printed on a card in December has
          to still resolve in the last week of the month. */}
      <Route path="/gift" element={<GiftBuy />} />
      <Route path="/gifted" element={<Gifted />} />
      <Route path="/g/:token" element={<Redeem />} />
      <Route path="/g/:token/card" element={<GiftCard />} />

      <Route path="*" element={<Home />} />
    </Routes>
  )
}
