import { AlertTriangle, CheckCircle2, CircleDashed, ShieldAlert } from 'lucide-react';
import type { ClaimStatus } from '@shared/types';

const CONFIG: Record<
  ClaimStatus,
  { label: string; className: string; icon: typeof CheckCircle2; description: string }
> = {
  verified: {
    label: '已核验',
    className: 'chip-verified',
    icon: CheckCircle2,
    description: '原文引用与数值均可核对',
  },
  partial: {
    label: '待核实',
    className: 'chip-warning',
    icon: AlertTriangle,
    description: '有引用，但缺少基期、分母或完整公式',
  },
  unsupported: {
    label: '无依据',
    className: 'chip-danger',
    icon: ShieldAlert,
    description: '原文中没有找到可逐字核对的引用',
  },
  conflict: {
    label: '口径冲突',
    className: 'chip-danger',
    icon: CircleDashed,
    description: '多个来源或口径互相矛盾',
  },
};

export function StatusBadge({ status, short = false }: { status: ClaimStatus; short?: boolean }) {
  const config = CONFIG[status];
  const Icon = config.icon;
  return (
    <span className={`chip ${config.className}`} title={config.description}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {short ? config.label.slice(0, 2) : config.label}
    </span>
  );
}

export function statusLabel(status: ClaimStatus): string {
  return CONFIG[status].label;
}
