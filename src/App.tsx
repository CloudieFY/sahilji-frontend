import React, { useState, useEffect } from 'react';

// --- 1. Route Imports ---
import Index from './routes/index';
import AdminLogin from './routes/admin-login';
import Approvals from './routes/approvals';
import Availability from './routes/availability';
import Calendar from './routes/calendar';
import Customers from './routes/customers';
import Deliveries from './routes/deliveries';
import DueProducts from './routes/due-products';
import Inventory from './routes/inventory';
import Login from './routes/login';
import Rentals from './routes/rentals';
import Reports from './routes/reports';
import ReturnItems from './routes/return-items';
import Settings from './routes/settings';
import SignupPage from './routes/signup';
import ReceptionSignupPage from './routes/reception-signup';


// --- 1. Custom Link Component ---
// Replaces TanStack's <Link>. Updates the URL via the History API without page reloads.
export const Link = ({ to, children, className, onClick }: { to: string, children: React.ReactNode, className?: string, onClick?: () => void }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.history.pushState({}, '', to);
    
    // Manually dispatch a popstate event to notify the App component
    const navEvent = new PopStateEvent('popstate');
    window.dispatchEvent(navEvent);

    if (onClick) {
      onClick();
    }
  };

  return (
    <a href={to} onClick={handleClick} className={className}>
      {children}
    </a>
  );
};

const CustomerDetails = ({ id }: { id: string }) => <div><h1>Customer Details: {id}</h1></div>;
const NotFound = () => <div><h1>404</h1><p>Page not found.</p></div>;

// --- 3. Main App Component ---
export default function App() {
  // Track the current path in React state
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    // Listen for browser back/forward buttons and custom Link clicks
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // --- 4. Route Matching ---
  let content: React.ReactNode = <NotFound />;

  const exactRoutes: Record<string, React.ReactNode> = {
    '/': <Index />,
    '/admin-login': <AdminLogin />,
    '/approvals': <Approvals />,
    '/availability': <Availability />,
    '/calendar': <Calendar />,
    '/customers': <Customers />,
    '/deliveries': <Deliveries />,
    '/due-products': <DueProducts />,
    '/inventory': <Inventory />,
    '/login': <Login />,
    '/rentals': <Rentals />,
    '/reports': <Reports />,
    '/return-items': <ReturnItems />,
    '/settings': <Settings />,
    '/signup': <SignupPage />,
    '/reception-signup': <ReceptionSignupPage />,
  };

  if (exactRoutes[currentPath]) {
    content = exactRoutes[currentPath];
  } else {
    // Dynamic route matching (e.g /customers/123)
    const customerMatch = currentPath.match(/^\/customers\/([^/]+)$/);
    if (customerMatch) {
      content = <CustomerDetails id={customerMatch[1]} />;
    }
  }

  return (
    <>
      {content}
    </>
  );
}