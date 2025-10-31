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

import NotificationSystem from './components/NotificationSystem';
import { useAuth } from './contexts/AuthContext';

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
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={user ? <DashboardLayout /> : <Navigate to="/login" replace />}>
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="merchants" element={<MerchantsPage />} />
          <Route path="drivers" element={<DriversPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="wallet" element={<AdminWalletPage />} />
          <Route path="subscriptions" element={<MerchantSubscriptionsPage />} />
          <Route path="promotions" element={<PromotionsPage />} />
          <Route path="promotion-rules" element={<PromotionRulesPage />} />
        </Route>
        <Route path="*" element={<Navigate to={user ? "/" : "/login"} replace />} />
      </Routes>
      <NotificationSystem />
    </div>
  );
}

export default App;