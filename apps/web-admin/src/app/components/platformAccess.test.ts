import { describe, expect, it } from 'vitest';
import {
  canAccessModule,
  canAccessStockReportTab,
  canAccessVentasTab,
  canManageUsers,
  getAllowedModules,
  getBottomNavModules,
  getDefaultVentasTab,
  getInitials,
  getSettingsTabs,
  getSidebarModules,
  normalizeRole,
  shouldShowBottomNavigation,
  ventasSettingsPrintersOnly,
} from '@/features/platform/config/modules';

describe('platformAccess', () => {
  describe('normalizeRole', () => {
    it('passes through platform roles unchanged', () => {
      expect(normalizeRole('SuperAdmin')).toBe('SuperAdmin');
      expect(normalizeRole('Operador_Stock')).toBe('Operador_Stock');
      expect(normalizeRole('Vendedor')).toBe('Vendedor');
      expect(normalizeRole('Gerente_Ventas')).toBe('Gerente_Ventas');
      expect(normalizeRole('Operador_Futbol')).toBe('Operador_Futbol');
      expect(normalizeRole('Operador_Cocina')).toBe('Operador_Cocina');
    });

    it('maps legacy roles to platform roles', () => {
      expect(normalizeRole('Admin')).toBe('SuperAdmin');
      expect(normalizeRole('Operador')).toBe('Vendedor');
      expect(normalizeRole('Viewer')).toBe('Operador_Stock');
      expect(normalizeRole('Gerente_Operaciones')).toBe('Gerente_Ventas');
      expect(normalizeRole('Encargado_Stock')).toBe('Operador_Stock');
      expect(normalizeRole('Encargado_Futbol')).toBe('Operador_Futbol');
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

    it('Operador_Stock has only stock', () => {
      expect(getAllowedModules('Operador_Stock')).toEqual(['stock']);
    });

    it('Vendedor has only ventas', () => {
      expect(getAllowedModules('Vendedor')).toEqual(['ventas']);
    });

    it('Gerente_Ventas has only ventas', () => {
      expect(getAllowedModules('Gerente_Ventas')).toEqual(['ventas']);
    });

    it('Operador_Futbol has only futbol', () => {
      expect(getAllowedModules('Operador_Futbol')).toEqual(['futbol']);
    });

    it('Operador_Cocina has only online', () => {
      expect(getAllowedModules('Operador_Cocina')).toEqual(['online']);
    });
  });

  describe('granular permissions', () => {
    it('Operador_Stock cannot see stock metrics or history tabs', () => {
      expect(canAccessStockReportTab('Operador_Stock', 'control')).toBe(true);
      expect(canAccessStockReportTab('Operador_Stock', 'movimientos')).toBe(true);
      expect(canAccessStockReportTab('Operador_Stock', 'alertas')).toBe(false);
      expect(canAccessStockReportTab('Operador_Stock', 'historial')).toBe(false);
    });

    it('Vendedor sees limited ventas tabs and printer settings only', () => {
      expect(canAccessVentasTab('Vendedor', 'mostrador')).toBe(true);
      expect(canAccessVentasTab('Vendedor', 'pedidos')).toBe(true);
      expect(canAccessVentasTab('Vendedor', 'devoluciones')).toBe(true);
      expect(canAccessVentasTab('Vendedor', 'productos')).toBe(false);
      expect(canAccessVentasTab('Vendedor', 'reportes')).toBe(false);
      expect(getDefaultVentasTab('Vendedor')).toBe('mostrador');
      expect(ventasSettingsPrintersOnly('Vendedor')).toBe(true);
      expect(getSettingsTabs('Vendedor')).toEqual(['ventas']);
    });

    it('Gerente_Ventas has full ventas panel', () => {
      expect(canAccessVentasTab('Gerente_Ventas', 'reportes')).toBe(true);
      expect(canAccessVentasTab('Gerente_Ventas', 'productos')).toBe(true);
      expect(ventasSettingsPrintersOnly('Gerente_Ventas')).toBe(false);
    });

    it('only SuperAdmin can manage users', () => {
      expect(canManageUsers('SuperAdmin')).toBe(true);
      expect(canManageUsers('Admin')).toBe(true);
      expect(canManageUsers('Gerente_Ventas')).toBe(false);
      expect(canManageUsers('Vendedor')).toBe(false);
    });
  });

  describe('getBottomNavModules', () => {
    it('returns empty for single-module users', () => {
      expect(getBottomNavModules('Operador_Stock')).toEqual([]);
      expect(getBottomNavModules('Operador_Futbol')).toEqual([]);
      expect(getBottomNavModules('Vendedor')).toEqual([]);
    });

    it('includes dashboard in center for multi-module users', () => {
      const modules = getBottomNavModules('SuperAdmin');
      expect(modules).toContain('dashboard');
      expect(modules.length).toBe(5);
    });
  });

  describe('getSidebarModules', () => {
    it('includes dashboard + allowed modules', () => {
      const modules = getSidebarModules('Gerente_Ventas');
      expect(modules).toEqual(['dashboard', 'ventas']);
    });
  });

  describe('shouldShowBottomNavigation', () => {
    it('false for single module', () => {
      expect(shouldShowBottomNavigation('Operador_Stock')).toBe(false);
      expect(shouldShowBottomNavigation('Operador_Futbol')).toBe(false);
      expect(shouldShowBottomNavigation('Vendedor')).toBe(false);
    });

    it('true for SuperAdmin', () => {
      expect(shouldShowBottomNavigation('SuperAdmin')).toBe(true);
    });
  });

  describe('getInitials', () => {
    it('extracts initials from dotted username', () => {
      expect(getInitials('juan.perez')).toBe('JP');
      expect(getInitials('gerente.operaciones')).toBe('GO');
    });

    it('handles underscore-separated usernames', () => {
      expect(getInitials('operador_stock')).toBe('OS');
    });
  });
});
