/** Claves de localStorage — no renombrar sin migración de datos en clientes. */
export const storageKeys = {
  inventory: {
    products: 'stock-products',
    warehouses: 'stock-warehouses',
    orders: 'stock-orders',
    auditLog: 'stock-auditlog',
    categories: 'stock-categories',
    consumption: 'stock-consumption',
    employeeConsumption: 'stock-employee-consumption',
    suppliers: 'stock-suppliers',
    darkMode: 'stock-darkmode',
    alertDay: 'stock-alert-day',
    currentUser: 'stock-current-user',
    users: 'stock-users',
  },
  sales: {
    kitchens: 'sales-kitchens',
    products: 'sales-products',
    tickets: 'sales-tickets',
    ticketCounter: 'sales-ticket-counter',
    tables: 'sales-tables',
    history: 'sales-history',
    auditLog: 'sales-auditlog',
  },
  kitchen: {
    orders: 'kitchen-orders',
  },
  online: {
    products: 'online-products',
    sponsors: 'sponsors',
    media: 'media-items',
  },
} as const;
