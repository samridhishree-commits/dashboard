import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { ScrollToTop } from './components/ScrollToTop'
import { AdminPage } from './pages/AdminPage'
import { InstitutePage } from './pages/InstitutePage'
import { VoicebotPage } from './pages/VoicebotPage'
import { ChannelPlaceholderPage } from './pages/ChannelPlaceholderPage'
import { AllLeadsPage } from './pages/AllLeadsPage'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/institute/:instituteId" element={<InstitutePage />} />
          <Route path="/institute/:instituteId/leads" element={<AllLeadsPage />} />
          <Route path="/institute/:instituteId/voicebot" element={<VoicebotPage />} />
          <Route path="/institute/:instituteId/voicebot/:campaignId" element={<VoicebotPage />} />
          <Route
            path="/institute/:instituteId/sms"
            element={<ChannelPlaceholderPage channel="sms" />}
          />
          <Route
            path="/institute/:instituteId/sms/:campaignId"
            element={<ChannelPlaceholderPage channel="sms" />}
          />
          <Route
            path="/institute/:instituteId/email"
            element={<ChannelPlaceholderPage channel="email" />}
          />
          <Route
            path="/institute/:instituteId/email/:campaignId"
            element={<ChannelPlaceholderPage channel="email" />}
          />
          <Route
            path="/institute/:instituteId/whatsapp"
            element={<ChannelPlaceholderPage channel="whatsapp" />}
          />
          <Route
            path="/institute/:instituteId/whatsapp/:campaignId"
            element={<ChannelPlaceholderPage channel="whatsapp" />}
          />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
