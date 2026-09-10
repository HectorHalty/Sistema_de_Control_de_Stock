/**
 * Claves de localStorage — no renombrar sin migración de datos en clientes.
 *
 * Proyecto C (docs/superpowers/plans/2026-09-07-admin-fuente-de-verdad-c.md):
 * las claves marcadas "legacy" ya no las escribe ningún `useLocalStorage` —
 * los datasets que representaban pasaron a React Query (fuente de lectura,
 * con su propia caché bajo la clave `lch-admin-query-cache`, ver
 * `app/App.tsx`). Quedan documentadas acá, sin borrar, porque un browser
 * con datos viejos de antes de Proyecto C todavía las tiene escritas — no
 * son necesarias hoy, pero borrarlas no libera nada que valga la pena y
 * romper el valor por si algún código viejo en caché las lee sería peor.
 */
export const storageKeys = {
  auth: {
    accessToken: 'lch-auth-token',
    user: 'lch-auth-user',
  },
  inventory: {
    products: 'stock-products', // legacy — ver React Query, Task 2
    warehouses: 'stock-warehouses', // legacy — ver React Query, Task 2
    orders: 'stock-orders', // legacy — ver React Query, Task 2
    auditLog: 'stock-auditlog',
    categories: 'stock-categories', // legacy — ver React Query, Task 2
    consumption: 'stock-consumption',
    employeeConsumption: 'stock-employee-consumption', // legacy — ver React Query, Task 2
    movements: 'stock-movements', // legacy — ver React Query, Task 2
    countSessions: 'stock-count-sessions', // legacy — ver React Query, Task 2
    suppliers: 'stock-suppliers', // legacy — ver React Query, Task 2
    darkMode: 'stock-darkmode',
    alertDay: 'stock-alert-day', // se escribe local y se pisa con React Query (Task 4, 2026-09-10)
    currentUser: 'stock-current-user',
    users: 'stock-users',
    lowStockNotifications: 'stock-low-notifications', // se escribe local y se pisa con React Query (Task 4, 2026-09-10)
    autoAlerts: 'stock-auto-alerts', // se escribe local y se pisa con React Query (Task 4, 2026-09-10)
    packRounding: 'stock-pack-rounding', // se escribe local y se pisa con React Query (Task 4, 2026-09-10)
  },
  platform: {
    notificationsEnabled: 'platform-notifications',
    notificationSound: 'platform-notification-sound',
  },
  sales: {
    categories: 'sales-categories',
    categoryEmojis: 'sales-category-emojis',
    kitchens: 'sales-kitchens', // legacy — ver React Query, Task 4
    products: 'sales-products', // legacy — ver React Query, Task 4
    tickets: 'sales-tickets', // legacy — ver React Query, Task 4 (ya no lo escribe useLocalStorage)
    ticketCounter: 'sales-ticket-counter',
    tables: 'sales-tables',
    history: 'sales-history',
    auditLog: 'sales-auditlog',
    printers: 'sales-printers',
    ticketTemplate: 'sales-ticket-template', // se escribe local y se pisa con React Query (Task 4, 2026-09-10)
    validateStockOnSale: 'sales-validate-stock', // se escribe local y se pisa con React Query (Task 4, 2026-09-10)
    raceConditionProtection: 'sales-race-protection', // se escribe local y se pisa con React Query (Task 4, 2026-09-10)
    teamAccounts: 'sales-team-accounts',
  },
  futbol: {
    showPublicFixture: 'futbol-public-fixture',
    matchNotifications: 'futbol-match-notifications', // se escribe local y se pisa con React Query (Task 4, 2026-09-10)
    defaultCategory: 'futbol-default-category', // se escribe local y se pisa con React Query (Task 4, 2026-09-10)
  },
  kitchen: {
    orders: 'kitchen-orders',
  },
  online: {
    products: 'online-products',
    sponsors: 'sponsors',
    media: 'media-items',
    orderNotifications: 'online-order-notifications', // se escribe local y se pisa con React Query (Task 4, 2026-09-10)
    syncCatalogWithStock: 'online-sync-catalog', // se escribe local y se pisa con React Query (Task 4, 2026-09-10)
    webChannelEnabled: 'online-web-channel', // se escribe local y se pisa con React Query (Task 4, 2026-09-10)
    appChannelEnabled: 'online-app-channel', // se escribe local y se pisa con React Query (Task 4, 2026-09-10)
  },
} as const;
