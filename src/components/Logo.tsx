import { Link } from 'react-router-dom';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="brand group" aria-label="证析 EvidenceFlow 首页">
      <span className="seal transition-transform duration-200 group-hover:-rotate-3">证</span>
      {!compact && (
        <span className="leading-none">
          <span className="brand-name block">证析</span>
          <span className="brand-sub block mt-1">EvidenceFlow</span>
        </span>
      )}
    </Link>
  );
}
