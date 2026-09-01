import type { AuditLogEntry } from './types';

let auditCounter = 0;

export class AuditService {
  private logs: AuditLogEntry[] = [];

  write(entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'requestId'> & { requestId?: string }): AuditLogEntry {
    const log: AuditLogEntry = {
      id: `audit-${++auditCounter}`,
      timestamp: new Date().toISOString(),
      requestId: entry.requestId ?? `req-${Date.now()}`,
      ...entry,
    };
    this.logs.unshift(log);
    return log;
  }

  list(filters: {
    adminId?: string;
    action?: string;
    targetType?: string;
    targetId?: string;
    from?: string;
    to?: string;
    page?: number;
    pageSize?: number;
  } = {}): { items: AuditLogEntry[]; total: number } {
    let items = [...this.logs];
    if (filters.adminId) items = items.filter((l) => l.adminId === filters.adminId);
    if (filters.action) items = items.filter((l) => l.action.includes(filters.action!));
    if (filters.targetType) items = items.filter((l) => l.targetType === filters.targetType);
    if (filters.targetId) items = items.filter((l) => l.targetId === filters.targetId);
    if (filters.from) items = items.filter((l) => l.timestamp >= filters.from!);
    if (filters.to) items = items.filter((l) => l.timestamp <= filters.to!);
    const total = items.length;
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 50;
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total };
  }

  deleteAll(adminRole: string): number {
    if (adminRole !== 'SUPER_ADMIN') throw new Error('Only SUPER_ADMIN can delete audit logs');
    const count = this.logs.length;
    this.logs = [];
    return count;
  }

  _reset(): void {
    this.logs = [];
    auditCounter = 0;
  }
}

export const auditService = new AuditService();
