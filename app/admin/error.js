'use client';

export default function AdminError({ reset }) {
  return <main className="admin-wrap admin-content"><h1>We couldn’t load this page.</h1><p>Please try again or refresh the page.</p><button className="admin-control" onClick={reset}>Try again</button></main>;
}
