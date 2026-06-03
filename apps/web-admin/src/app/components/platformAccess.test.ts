import { describe, expect, it } from 'vitest';
import { getAllowedModules, getBottomNavModules, getInitials, getSidebarModules, normalizeRole, shouldShowBottomNavigation } from '@/features/platform/config/modules';
import type { CurrentUser } from './store';

describe('platformAccess', () => {
  describe('normalizeRole', () => {
    it('passes through platform roles unchanged', () => {
      expect(normalizeRole('SuperAdmin')).toBe('SuperAdmin');
      expect(normalizeRole('Gerente_Operaciones')).toBe('Gerente_Operaciones');
      expect(normalizeRole('Encargado_Stock')).toBe('Encargado_Stock');
      expect(normalizeRole('Encargado_Futbol')).toBe('Encargado_Futbol');
    });

    it('maps legacy roles to platform roles', () => {
      expect(normalizeRole('Admin')).toBe('SuperAdmin');
      expect(normalizeRole('Operador')).toBe('Gerente_Operaciones');
      expect(normalizeRole('Viewer')).toBe('Encargado_Stock');
    });
  });

  describe('getAllowedModules', () => {
    it('SuperAdmin has all modules', () => {
      const modules = getAllowedModules('SuperAdmin');
      expect(modules).toContain('stock');
      expect(modules).toContain('ventas');
      expect(modules).toContain('online');
      expect(modules).toContain('futbol');
    });

    it('Encargado_Stock has only stock', () => {
      const modules = getAllowedModules('Encargado_Stock');
      expect(modules).toEqual(['stock']);
    });

    it('Admin (legacy) maps to SuperAdmin permissions', () => {
      const modules = getAllowedModules('Admin');
      expect(modules).toContain('stock');
      expect(modules).toContain('ventas');
    });
  });

  describe('getBottomNavModules', () => {
    it('returns empty for single-module users', () => {
      const modules = getBottomNavModules('Encargado_Stock');
      expect(modules).toEqual([]);
    });

    it('returns empty for no-module users', () => {
      // Encargado_Futbol has futbol module, so not empty
      // We need a role with 0 modules - none exist, so test single module
      const modules = getBottomNavModules('Encargado_Futbol');
      expect(modules).toEqual([]);
    });

    it('includes dashboard in center for multi-module users', () => {
      const modules = getBottomNavModules('Gerente_Operaciones');
      expect(modules).toContain('dashboard');
      expect(modules.length).toBe(3); // stock + dashboard + ventas (or similar)
    });

    it('SuperAdmin has all modules around dashboard', () => {
      const modules = getBottomNavModules('SuperAdmin');
      expect(modules).toContain('dashboard');
      expect(modules.length).toBe(5); // 4 modules + dashboard
    });
  });

  describe('getSidebarModules', () => {
    it('includes dashboard + allowed modules', () => {
      const modules = getSidebarModules('Gerente_Operaciones');
      expect(modules[0]).toBe('dashboard');
      expect(modules).toContain('stock');
      expect(modules).toContain('ventas');
    });
  });

  describe('shouldShowBottomNavigation', () => {
    it('false for single module', () => {
      expect(shouldShowBottomNavigation('Encargado_Stock')).toBe(false);
      expect(shouldShowBottomNavigation('Encargado_Futbol')).toBe(false);
    });

    it('true for multiple modules', () => {
      expect(shouldShowBottomNavigation('Gerente_Operaciones')).toBe(true);
      expect(shouldShowBottomNavigation('SuperAdmin')).toBe(true);
    });
  });

  describe('getInitials', () => {
    it('extracts initials from dotted username', () => {
      expect(getInitials('juan.perez')).toBe('JP');
      expect(getInitials('gerente.operaciones')).toBe('GO');
    });

    it('extracts initials from space-separated username', () => {
      expect(getInitials('juan perez')).toBe('JP');
    });

    it('handles single word usernames', () => {
      expect(getInitials('admin')).toBe('AD');
      expect(getInitials('a')).toBe('A');
    });

    it('handles underscore-separated usernames', () => {
      expect(getInitials('encargado_stock')).toBe('ES');
    });
  });
});
