export type Station = string;

export const stations: Station[] = ["Parrilla", "Barra", "Cervecería", "Cocina"];

export type Product = {
  id: string;
  name: string;
  price: number;
  category: string;
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
