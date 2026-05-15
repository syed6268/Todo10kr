import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext.jsx'
import AppLayout from './components/AppLayout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Goals from './pages/Goals.jsx'
import Calendar from './pages/Calendar.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  )
}
