import { Route, Routes } from 'react-router-dom'
import BookingPage from './pages/BookingPage'
import CheckoutPage from './pages/CheckoutPage'

export default function App() {
  return (
    <main className="flex flex-1 flex-col">
      <Routes>
        <Route path="/" element={<BookingPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
      </Routes>
    </main>
  )
}
