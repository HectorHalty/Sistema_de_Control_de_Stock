export type Station = "Parrilla" | "Barra" | "Cervecería" | "Cocina";

export const stations: Station[] = ["Parrilla", "Barra", "Cervecería", "Cocina"];

export type Product = {
  id: string;
  name: string;
  price: number;
  category: "Bebidas" | "Comidas" | "Snacks" | "Postres";
  station: Station;
  stock: number;
  emoji: string;
  recipe?: { ingredientId: string; qty: number }[];
};

export type Ingredient = {
  id: string;
  name: string;
  unit: string;
  stock: number;
};

export type OrderItem = {
  productId: string;
  name: string;
  price: number;
  qty: number;
};

export type TeamAccount = {
  id: string;
  team: string;
  openedAt: string;
  status: "abierta" | "cerrada";
  items: OrderItem[];
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Operador";
};

export const initialIngredients: Ingredient[] = [
  { id: "ing1", name: "Pan de hamburguesa", unit: "u", stock: 80 },
  { id: "ing2", name: "Medallón de carne", unit: "u", stock: 60 },
  { id: "ing3", name: "Feta de queso", unit: "u", stock: 120 },
  { id: "ing4", name: "Lechuga", unit: "g", stock: 2000 },
  { id: "ing5", name: "Tomate", unit: "g", stock: 1500 },
  { id: "ing6", name: "Pan de pancho", unit: "u", stock: 50 },
  { id: "ing7", name: "Salchicha", unit: "u", stock: 70 },
];

export const initialProducts: Product[] = [
  {
    id: "p1",
    name: "Hamburguesa Simple",
    price: 3500,
    category: "Comidas",
    station: "Parrilla",
    stock: 60,
    emoji: "🍔",
    recipe: [
      { ingredientId: "ing1", qty: 1 },
      { ingredientId: "ing2", qty: 1 },
      { ingredientId: "ing3", qty: 1 },
    ],
  },
  {
    id: "p2",
    name: "Hamburguesa Completa",
    price: 4800,
    category: "Comidas",
    station: "Parrilla",
    stock: 40,
    emoji: "🍔",
    recipe: [
      { ingredientId: "ing1", qty: 1 },
      { ingredientId: "ing2", qty: 1 },
      { ingredientId: "ing3", qty: 2 },
      { ingredientId: "ing4", qty: 20 },
      { ingredientId: "ing5", qty: 30 },
    ],
  },
  {
    id: "p3",
    name: "Pancho",
    price: 2200,
    category: "Comidas",
    station: "Cocina",
    stock: 50,
    emoji: "🌭",
    recipe: [
      { ingredientId: "ing6", qty: 1 },
      { ingredientId: "ing7", qty: 1 },
    ],
  },
  { id: "p4", name: "Gatorade", price: 2800, category: "Bebidas", station: "Barra", stock: 35, emoji: "🥤" },
  { id: "p5", name: "Coca-Cola 500ml", price: 2000, category: "Bebidas", station: "Barra", stock: 48, emoji: "🥤" },
  { id: "p6", name: "Agua Mineral", price: 1500, category: "Bebidas", station: "Barra", stock: 70, emoji: "💧" },
  { id: "p7", name: "Cerveza", price: 3200, category: "Bebidas", station: "Cervecería", stock: 24, emoji: "🍺" },
  { id: "p8", name: "Papas Fritas", price: 2500, category: "Snacks", station: "Cocina", stock: 30, emoji: "🍟" },
  { id: "p9", name: "Alfajor", price: 1200, category: "Snacks", station: "Barra", stock: 80, emoji: "🍫" },
  { id: "p10", name: "Helado", price: 2800, category: "Postres", station: "Barra", stock: 20, emoji: "🍦" },
];

export const initialTeams: TeamAccount[] = [
  {
    id: "t1",
    team: "Los Pibes FC",
    openedAt: "14:30",
    status: "abierta",
    items: [
      { productId: "p1", name: "Hamburguesa Simple", price: 3500, qty: 4 },
      { productId: "p4", name: "Gatorade", price: 2800, qty: 6 },
    ],
  },
  {
    id: "t2",
    team: "Veteranos del Barrio",
    openedAt: "15:00",
    status: "abierta",
    items: [
      { productId: "p7", name: "Cerveza", price: 3200, qty: 8 },
      { productId: "p8", name: "Papas Fritas", price: 2500, qty: 3 },
    ],
  },
  {
    id: "t3",
    team: "Las Leonas Sub-17",
    openedAt: "16:15",
    status: "abierta",
    items: [
      { productId: "p6", name: "Agua Mineral", price: 1500, qty: 12 },
      { productId: "p9", name: "Alfajor", price: 1200, qty: 8 },
    ],
  },
];

export const initialUsers: User[] = [
  { id: "u1", name: "Carlos Méndez", email: "carlos@cantina.com", role: "Admin" },
  { id: "u2", name: "Sofía Ramírez", email: "sofia@cantina.com", role: "Operador" },
  { id: "u3", name: "Lucas Pereyra", email: "lucas@cantina.com", role: "Operador" },
  { id: "u4", name: "Marta Iglesias", email: "marta@cantina.com", role: "Admin" },
];

export const salesByDay = [
  { day: "Lun", ventas: 42000 },
  { day: "Mar", ventas: 38500 },
  { day: "Mié", ventas: 51000 },
  { day: "Jue", ventas: 47200 },
  { day: "Vie", ventas: 89000 },
  { day: "Sáb", ventas: 142000 },
  { day: "Dom", ventas: 165000 },
];

export const topProducts = [
  { name: "Hamburguesa Simple", value: 124 },
  { name: "Gatorade", value: 98 },
  { name: "Cerveza", value: 87 },
  { name: "Pancho", value: 76 },
  { name: "Coca-Cola", value: 64 },
];
