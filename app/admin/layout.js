import './admin.css';
import { SessionSync } from './ui';

export const metadata = {
  title: 'Brand Audit registrations | JG Worldwide',
  robots: { index: false, follow: false },
  icons: {
    icon: [
      {
        url: 'https://cdn.prod.website-files.com/654879169973ca2687439f30/68414681a32a35f9cb311366_bimi-logo-tiny.svg',
        type: 'image/svg+xml',
      },
    ],
  },
};

export default function AdminLayout({ children }) {
  return <div className="admin-surface"><SessionSync />{children}</div>;
}
