import './admin.css';

export const metadata = {
  title: 'Brand Audit registrations | JG Worldwide',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }) {
  return <div className="admin-surface">{children}</div>;
}
