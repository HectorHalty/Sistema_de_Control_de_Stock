import { Injectable, Logger } from '@nestjs/common';

export interface AuditLogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  action: string;
  detail: string;
  userId?: string;
  ip?: string;
}

@Injectable()
export class SecurityLogger {
  private readonly logger = new Logger('Security');

  log(entry: AuditLogEntry) {
    const msg = `[${entry.action}] ${entry.detail}${entry.userId ? ` (user: ${entry.userId})` : ''}${entry.ip ? ` from ${entry.ip}` : ''}`;

    switch (entry.level) {
      case 'WARN':
        this.logger.warn(msg);
        break;
      case 'ERROR':
        this.logger.error(msg);
        break;
      default:
        this.logger.log(msg);
    }
  }

  failedLogin(username: string, ip?: string) {
    this.log(createFailedLoginEntry(username, ip));
  }

  successfulLogin(userId: string, username: string, ip?: string) {
    this.log(createSuccessfulLoginEntry(userId, username, ip));
  }

  mutation(userId: string, action: string, resource: string, ip?: string) {
    this.log(createMutationEntry(userId, action, resource, ip));
  }
}

export function createAuditEntry(
  action: string,
  detail: string,
  level: AuditLogEntry['level'] = 'INFO',
  userId?: string,
  ip?: string,
): AuditLogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    action,
    detail,
    userId,
    ip,
  };
}

export function createFailedLoginEntry(username: string, ip?: string): AuditLogEntry {
  return createAuditEntry(
    'LOGIN_FAILED',
    `Failed login attempt for user: ${username}`,
    'WARN',
    undefined,
    ip,
  );
}

export function createSuccessfulLoginEntry(userId: string, username: string, ip?: string): AuditLogEntry {
  return createAuditEntry(
    'LOGIN_SUCCESS',
    `Successful login for user: ${username}`,
    'INFO',
    userId,
    ip,
  );
}

export function createMutationEntry(userId: string, action: string, resource: string, ip?: string): AuditLogEntry {
  return createAuditEntry(
    `MUTATION_${action.toUpperCase()}`,
    `${action} on ${resource} by user ${userId}`,
    'INFO',
    userId,
    ip,
  );
}
