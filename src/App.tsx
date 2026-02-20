import { Route, Switch, Redirect, useLocation } from 'wouter';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastContainer } from './components/Toast';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Verify from './pages/Verify';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Home from './pages/Home';

function Spinner() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AppRoutes() {
  const { user, loading } = useAuth();
  const [location] = useLocation();

  if (loading) return <Spinner />;

  const publicPaths = ['/login', '/signup', '/forgot-password', '/reset-password'];
  const isPublic = publicPaths.some((p) => location.startsWith(p));

  if (!user && !isPublic) return <Redirect to="/login" />;
  if (user && (location === '/login' || location === '/signup')) {
    return <Redirect to={user.verified ? '/home' : '/verify'} />;
  }
  if (user && !user.verified && location === '/home') return <Redirect to="/verify" />;
  if (user && user.verified && location === '/verify') return <Redirect to="/home" />;

  return (
    <Switch>
      <Route path="/login"><Login /></Route>
      <Route path="/signup"><Signup /></Route>
      <Route path="/verify"><Verify /></Route>
      <Route path="/forgot-password"><ForgotPassword /></Route>
      <Route path="/reset-password"><ResetPassword /></Route>
      <Route path="/home"><Home /></Route>
      <Route path="/"><Redirect to={user ? (user.verified ? '/home' : '/verify') : '/login'} /></Route>
    </Switch>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppRoutes />
        <ToastContainer />
      </AuthProvider>
    </ToastProvider>
  );
}
