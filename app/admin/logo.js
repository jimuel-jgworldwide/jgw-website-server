const logoUrl = 'https://cdn.prod.website-files.com/654879169973ca2687439f30/65954747d644eef0dffc1c0d_white%20logo%20copy.png';

export default function AdminLogo({ className = '' }) {
  return (
    <img
      className={`admin-logo ${className}`.trim()}
      src={logoUrl}
      alt="JG Worldwide"
      width="1701"
      height="349"
    />
  );
}
