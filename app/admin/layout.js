import './admin.css';
import { SessionSync } from './ui';

export const metadata = {
  title: 'Brand Audit registrations | JG Worldwide',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
  return <div className="admin-surface"><SessionSync />{children}</div>;
}
