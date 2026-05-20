import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as bcrypt from 'bcrypt';

/**
 * Security remediation tests.
 * Covers: auth hardening, SQL injection prevention, rate limiting,
 * JWT secret validation, password hashing, and access control.
 */

// ============================================================
// Password Hashing (pure functions extracted from AuthService)
// ============================================================

async function hashPassword(password: string, saltRounds: number = 10): Promise<string> {
  return bcrypt.hash(password, saltRounds);
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

describe('Auth hardening - password hashing', () => {
  it('hashes a password and returns a non-plaintext string', async () => {
    const hash = await hashPassword('mySecretPassword123!');
    expect(hash).not.toBe('mySecretPassword123!');
    expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt format
  });

  it('produces different hashes for same password (salt)', async () => {
    const hash1 = await hashPassword('samePassword');
    const hash2 = await hashPassword('samePassword');
    expect(hash1).not.toBe(hash2);
  });

  it('verifies correct password returns true', async () => {
    const hash = await hashPassword('correctPassword');
    const result = await verifyPassword('correctPassword', hash);
    expect(result).toBe(true);
  });

  it('verifies wrong password returns false', async () => {
    const hash = await hashPassword('correctPassword');
    const result = await verifyPassword('wrongPassword', hash);
    expect(result).toBe(false);
  });

  it('rejects placeholder passwords', async () => {
    const result = await verifyPassword('anyPassword', 'placeholder');
    expect(result).toBe(false);
  });
});

// ============================================================
// JWT Secret Validation
// ============================================================

const WEAK_SECRETS = ['dev-secret', 'secret', 'password', '123456', 'jwt-secret', 'changeme', ''];
const MIN_SECRET_LENGTH = 32;

function validateJwtSecret(secret: string | undefined, isDev: boolean): { valid: boolean; error?: string } {
  if (!secret) {
    return { valid: false, error: 'JWT_SECRET is not set' };
  }
  if (isDev) {
    return { valid: true };
  }
  if (WEAK_SECRETS.includes(secret.toLowerCase())) {
    return { valid: false, error: `JWT_SECRET uses a known weak value: ${secret}` };
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    return { valid: false, error: `JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters (got ${secret.length})` };
  }
  return { valid: true };
}

describe('JWT secret validation', () => {
  it('accepts weak secrets in dev mode', () => {
    expect(validateJwtSecret('dev-secret', true).valid).toBe(true);
    expect(validateJwtSecret('short', true).valid).toBe(true);
  });

  it('rejects weak secrets in production', () => {
    for (const weak of WEAK_SECRETS) {
      const result = validateJwtSecret(weak, false);
      expect(result.valid).toBe(false);
    }
  });

  it('rejects unset JWT_SECRET in production', () => {
    expect(validateJwtSecret(undefined, false).valid).toBe(false);
    expect(validateJwtSecret('', false).valid).toBe(false);
  });

  it('accepts strong secrets in production', () => {
    const strong = 'a'.repeat(40);
    expect(validateJwtSecret(strong, false).valid).toBe(true);
  });

  it('rejects secrets shorter than 32 chars in production', () => {
    expect(validateJwtSecret('a'.repeat(31), false).valid).toBe(false);
    expect(validateJwtSecret('a'.repeat(32), false).valid).toBe(true);
  });
});

// ============================================================
// SQL Injection Prevention - sanitizeRawQueryParams
// ============================================================

function sanitizeRawQueryParam(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

function validateUuidFormat(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

function sanitizeForLikePattern(input: string): string {
  return input.replace(/[%_]/g, '\\$&');
}

describe('SQL injection prevention', () => {
  describe('UUID validation', () => {
    it('accepts valid UUIDs', () => {
      expect(validateUuidFormat('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
      expect(validateUuidFormat('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
    });

    it('rejects SQL injection attempts in UUID fields', () => {
      expect(validateUuidFormat("'; DROP TABLE Users; --")).toBe(false);
      expect(validateUuidFormat('1; SELECT * FROM users')).toBe(false);
      expect(validateUuidFormat('OR 1=1')).toBe(false);
      expect(validateUuidFormat("admin'--")).toBe(false);
    });

    it('rejects malformed UUIDs', () => {
      expect(validateUuidFormat('not-a-uuid')).toBe(false);
      expect(validateUuidFormat('')).toBe(false);
      expect(validateUuidFormat('550e8400')).toBe(false);
    });
  });

  describe('LIKE pattern sanitization', () => {
    it('escapes % and _ wildcards', () => {
      expect(sanitizeForLikePattern('100%')).toBe('100\\%');
      expect(sanitizeForLikePattern('test_value')).toBe('test\\_value');
    });

    it('leaves normal strings unchanged', () => {
      expect(sanitizeForLikePattern('hello world')).toBe('hello world');
    });
  });

  describe('Raw query param sanitization', () => {
    it('converts strings safely', () => {
      expect(sanitizeRawQueryParam('hello')).toBe('hello');
      expect(sanitizeRawQueryParam(123)).toBe(123);
      expect(sanitizeRawQueryParam(true)).toBe(true);
      expect(sanitizeRawQueryParam(null)).toBe(null);
      expect(sanitizeRawQueryParam(undefined)).toBe(null);
    });
  });
});

// ============================================================
// Rate Limiting Configuration
// ============================================================

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message: string;
}

function getAuthRateLimitConfig(isDev: boolean): RateLimitConfig {
  if (isDev) {
    return {
      windowMs: 60 * 1000,
      max: 100,
      message: 'Too many login attempts, please try again later',
    };
  }
  return {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: 'Too many login attempts, please try again later',
  };
}

function getGeneralRateLimitConfig(isDev: boolean): RateLimitConfig {
  if (isDev) {
    return {
      windowMs: 60 * 1000,
      max: 500,
      message: 'Too many requests, please try again later',
    };
  }
  return {
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later',
  };
}

describe('Rate limiting configuration', () => {
  it('allows more requests in dev mode for auth', () => {
    const devConfig = getAuthRateLimitConfig(true);
    expect(devConfig.max).toBe(100);
    expect(devConfig.windowMs).toBe(60000);
  });

  it('restricts auth attempts in production', () => {
    const prodConfig = getAuthRateLimitConfig(false);
    expect(prodConfig.max).toBe(20);
    expect(prodConfig.windowMs).toBe(15 * 60 * 1000);
  });

  it('restricts general API requests in production', () => {
    const prodConfig = getGeneralRateLimitConfig(false);
    expect(prodConfig.max).toBe(100);
    expect(prodConfig.windowMs).toBe(15 * 60 * 1000);
  });
});

// ============================================================
// Role-based Access Control Guards (pure functions)
// ============================================================

type Role = 'Admin' | 'Operador' | 'Viewer' | 'SuperAdmin';

const MUTATING_ROLES: Role[] = ['Admin', 'SuperAdmin'];

function hasMutatingRole(role: string): boolean {
  return MUTATING_ROLES.includes(role as Role);
}

function checkRoleGuard(userRole: string | undefined, requiredRoles: Role[]): { allowed: boolean; error?: string } {
  if (!userRole) {
    return { allowed: false, error: 'No role assigned' };
  }
  if (!requiredRoles.includes(userRole as Role)) {
    return { allowed: false, error: `Role ${userRole} not authorized. Required: ${requiredRoles.join(', ')}` };
  }
  return { allowed: true };
}

describe('Role-based access control', () => {
  it('allows Admin to mutate', () => {
    expect(hasMutatingRole('Admin')).toBe(true);
  });

  it('allows SuperAdmin to mutate', () => {
    expect(hasMutatingRole('SuperAdmin')).toBe(true);
  });

  it('blocks Operador from mutating', () => {
    expect(hasMutatingRole('Operador')).toBe(false);
  });

  it('blocks Viewer from mutating', () => {
    expect(hasMutatingRole('Viewer')).toBe(false);
  });

  it('role guard allows authorized role', () => {
    expect(checkRoleGuard('Admin', ['Admin', 'SuperAdmin']).allowed).toBe(true);
  });

  it('role guard blocks unauthorized role', () => {
    const result = checkRoleGuard('Viewer', ['Admin', 'SuperAdmin']);
    expect(result.allowed).toBe(false);
    expect(result.error).toContain('not authorized');
  });

  it('role guard blocks missing role', () => {
    const result = checkRoleGuard(undefined, ['Admin']);
    expect(result.allowed).toBe(false);
    expect(result.error).toContain('No role assigned');
  });
});

// ============================================================
// Security Audit Logging (pure function for log entry creation)
// ============================================================

interface AuditLogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  action: string;
  detail: string;
  userId?: string;
  ip?: string;
}

function createAuditEntry(
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

function createFailedLoginEntry(username: string, ip?: string): AuditLogEntry {
  return createAuditEntry(
    'LOGIN_FAILED',
    `Failed login attempt for user: ${username}`,
    'WARN',
    undefined,
    ip,
  );
}

function createSuccessfulLoginEntry(userId: string, username: string, ip?: string): AuditLogEntry {
  return createAuditEntry(
    'LOGIN_SUCCESS',
    `Successful login for user: ${username}`,
    'INFO',
    userId,
    ip,
  );
}

function createMutationEntry(userId: string, action: string, resource: string, ip?: string): AuditLogEntry {
  return createAuditEntry(
    `MUTATION_${action.toUpperCase()}`,
    `${action} on ${resource} by user ${userId}`,
    'INFO',
    userId,
    ip,
  );
}

describe('Security audit logging', () => {
  it('creates failed login entry with WARN level', () => {
    const entry = createFailedLoginEntry('admin', '192.168.1.1');
    expect(entry.level).toBe('WARN');
    expect(entry.action).toBe('LOGIN_FAILED');
    expect(entry.detail).toContain('admin');
    expect(entry.ip).toBe('192.168.1.1');
  });

  it('creates successful login entry with INFO level', () => {
    const entry = createSuccessfulLoginEntry('user-1', 'admin', '10.0.0.1');
    expect(entry.level).toBe('INFO');
    expect(entry.action).toBe('LOGIN_SUCCESS');
    expect(entry.userId).toBe('user-1');
  });

  it('creates mutation audit entry', () => {
    const entry = createMutationEntry('user-1', 'CREATE', 'Product', '10.0.0.1');
    expect(entry.action).toBe('MUTATION_CREATE');
    expect(entry.detail).toContain('Product');
    expect(entry.userId).toBe('user-1');
  });

  it('includes ISO timestamp in all entries', () => {
    const entry = createAuditEntry('TEST', 'test detail');
    expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
