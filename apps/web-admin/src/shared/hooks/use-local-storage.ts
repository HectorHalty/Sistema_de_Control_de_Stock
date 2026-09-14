import { useCallback, useRef, useState } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch (error) {
      console.warn('Error reading localStorage', error);
      return initialValue;
    }
  });
  const storedRef = useRef(storedValue);
  storedRef.current = storedValue;

  // `useCallback` con deps [] — antes era una función nueva en cada render,
  // lo que hacía inestable cualquier `useEffect` que la tuviera como
  // dependencia (se re-disparaba en cada render del componente, no sólo
  // cuando el valor cambiaba de verdad). Encontrado en Proyecto C, Task 4
  // (docs/superpowers/plans/2026-09-07-admin-fuente-de-verdad-c.md): al
  // migrar otros datasets a React Query, el mount pasó a generar más
  // renders encadenados y esa inestabilidad, antes inocua, se convirtió en
  // un loop infinito real (settings/kitchen orders pedidos sin parar).
  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedRef.current) : value;
      storedRef.current = valueToStore;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.warn('Error setting localStorage', error);
    }
  }, [key]);

  return [storedValue, setValue] as const;
}
