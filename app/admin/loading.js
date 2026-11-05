import AdminLogo from './logo';

export default function Loading() {
  return <main className="admin-main" aria-busy="true" aria-label="Loading registrations">
    <div className="admin-route-progress" />
    <header className="admin-header"><div className="admin-wrap admin-header-inner"><AdminLogo className="admin-header-logo" /></div></header>
    <div className="admin-wrap admin-content"><span className="admin-sr-only" role="status">Loading, please wait.</span>
      <div className="admin-skeleton admin-skeleton-title" /><div className="admin-skeleton admin-skeleton-subtitle" />
      <div className="admin-skeleton-table">{Array.from({ length: 8 }, (_, i) => <div className="admin-skeleton-row" key={i}><div className="admin-skeleton" /><div className="admin-skeleton" /><div className="admin-skeleton" /></div>)}</div>
    </div>
  </main>;
}
