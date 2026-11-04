import { signIn } from '../actions';

export const dynamic = 'force-dynamic';

const messages = {
  invalid: 'Check your credentials or ask the site owner to grant this account access.',
  setup: 'Admin access has not been configured on this deployment.',
  unavailable: 'Sign-in is temporarily unavailable. Please try again.',
};

export default async function LoginPage({ searchParams }) {
  const { error } = await searchParams;
  const message = typeof error === 'string' && Object.hasOwn(messages, error)
    ? messages[error]
    : null;
  return (
    <main className="admin-login">
      <div className="admin-login-intro">
        <p className="admin-brand">JG Worldwide</p>
        <h1>Brand Audit registrations.</h1>
        <p>Sign in to view workshop registration details and payment proofs.</p>
      </div>
      <div className="admin-login-form-wrap">
        <h2>Admin sign in</h2>
        {message && <p className="admin-alert" role="alert">{message}</p>}
        <form action={signIn} className="admin-login-form">
          <label htmlFor="admin-email">Email address</label>
          <input id="admin-email" name="email" type="email" autoComplete="username" required />
          <label htmlFor="admin-password">Password</label>
          <input id="admin-password" name="password" type="password" autoComplete="current-password" required />
          <button className="admin-button" type="submit">Sign in</button>
        </form>
      </div>
    </main>
  );
}
