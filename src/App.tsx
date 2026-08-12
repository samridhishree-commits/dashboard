import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { AuthProvider } from './context/AuthContext'
import { ScrollToTop } from './components/ScrollToTop'
import { RequireAuth, RequireInstituteAccess } from './components/RequireAuth'
import { AdminPage } from './pages/AdminPage'
import { InstitutePage } from './pages/InstitutePage'
import { VoicebotPage } from './pages/VoicebotPage'
import { ChannelPlaceholderPage } from './pages/ChannelPlaceholderPage'
import { AllLeadsPage } from './pages/AllLeadsPage'
import { LoginPage } from './pages/LoginPage'
import { useAuth } from './context/AuthContext'

function HomeRedirect() {
  const { user, homePath } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={homePath} replace />
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<HomeRedirect />} />
            <Route
              path="/admin"
              element={
                <RequireAuth role="admin">
                  <AdminPage />
                </RequireAuth>
              }
            />
            <Route
              path="/institute/:instituteId"
              element={
                <RequireAuth>
                  <RequireInstituteAccess>
                    <InstitutePage />
                  </RequireInstituteAccess>
                </RequireAuth>
              }
            />
            <Route
              path="/institute/:instituteId/leads"
              element={
                <RequireAuth>
                  <RequireInstituteAccess>
                    <AllLeadsPage />
                  </RequireInstituteAccess>
                </RequireAuth>
              }
            />
            <Route
              path="/institute/:instituteId/voicebot"
              element={
                <RequireAuth>
                  <RequireInstituteAccess>
                    <VoicebotPage />
                  </RequireInstituteAccess>
                </RequireAuth>
              }
            />
            <Route
              path="/institute/:instituteId/voicebot/:campaignId"
              element={
                <RequireAuth>
                  <RequireInstituteAccess>
                    <VoicebotPage />
                  </RequireInstituteAccess>
                </RequireAuth>
              }
            />
            <Route
              path="/institute/:instituteId/sms"
              element={
                <RequireAuth>
                  <RequireInstituteAccess>
                    <ChannelPlaceholderPage channel="sms" />
                  </RequireInstituteAccess>
                </RequireAuth>
              }
            />
            <Route
              path="/institute/:instituteId/sms/:campaignId"
              element={
                <RequireAuth>
                  <RequireInstituteAccess>
                    <ChannelPlaceholderPage channel="sms" />
                  </RequireInstituteAccess>
                </RequireAuth>
              }
            />
            <Route
              path="/institute/:instituteId/email"
              element={
                <RequireAuth>
                  <RequireInstituteAccess>
                    <ChannelPlaceholderPage channel="email" />
                  </RequireInstituteAccess>
                </RequireAuth>
              }
            />
            <Route
              path="/institute/:instituteId/email/:campaignId"
              element={
                <RequireAuth>
                  <RequireInstituteAccess>
                    <ChannelPlaceholderPage channel="email" />
                  </RequireInstituteAccess>
                </RequireAuth>
              }
            />
            <Route
              path="/institute/:instituteId/whatsapp"
              element={
                <RequireAuth>
                  <RequireInstituteAccess>
                    <ChannelPlaceholderPage channel="whatsapp" />
                  </RequireInstituteAccess>
                </RequireAuth>
              }
            />
            <Route
              path="/institute/:instituteId/whatsapp/:campaignId"
              element={
                <RequireAuth>
                  <RequireInstituteAccess>
                    <ChannelPlaceholderPage channel="whatsapp" />
                  </RequireInstituteAccess>
                </RequireAuth>
              }
            />
            <Route path="*" element={<HomeRedirect />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </AuthProvider>
  )
}
