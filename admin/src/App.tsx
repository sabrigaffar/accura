import { Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import OrdersPage from './pages/OrdersPage';
import MerchantsPage from './pages/MerchantsPage';
import DriversPage from './pages/DriversPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import MerchantSubscriptionsPage from './pages/MerchantSubscriptionsPage';
import AdminWalletPage from './pages/AdminWalletPage';
import PromotionsPage from './pages/PromotionsPage';
import PromotionRulesPage from './pages/PromotionRulesPage';
import SponsoredAdsPage from './pages/SponsoredAdsPage';
import ComplaintsPage from './pages/ComplaintsPage';
import JoinRequestsPage from './pages/JoinRequestsPage';
import NotificationsLogPage from './pages/NotificationsLogPage';

import NotificationSystem from './components/NotificationSystem';
import { useAuth } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="App">
      <SettingsProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={user ? <DashboardLayout /> : <Navigate to="/login" replace />}>
            <Route index element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="merchants" element={<MerchantsPage />} />
            <Route path="drivers" element={<DriversPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="notifications-log" element={<NotificationsLogPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="wallet" element={<AdminWalletPage />} />
            <Route path="subscriptions" element={<MerchantSubscriptionsPage />} />
            <Route path="promotions" element={<PromotionsPage />} />
            <Route path="promotion-rules" element={<PromotionRulesPage />} />
            <Route path="sponsored-ads" element={<SponsoredAdsPage />} />
            <Route path="complaints" element={<ComplaintsPage />} />
            <Route path="join-requests" element={<JoinRequestsPage />} />
          </Route>
          <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
        </Routes>
        <NotificationSystem />
      </SettingsProvider>
    </div>
  );
}

export default App;