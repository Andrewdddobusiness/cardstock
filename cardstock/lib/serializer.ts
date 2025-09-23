import { Decimal } from "@prisma/client/runtime/library";

export function serializeDecimal(value: Decimal): string {
  return value.toString();
}

// Alternative approach using JSON.parse(JSON.stringify()) with custom replacer
export function serializeProductFast<T>(obj: T): any {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    // Handle Decimal objects
    if (value && typeof value === 'object' && typeof value.toJSON === 'function' && value.constructor?.name === 'Decimal') {
      return value.toString();
    }
    // Handle Date objects
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  }));
}

export function serializeProduct<T extends Record<string, any>>(obj: T): any {
  if (obj === null || obj === undefined) return obj;
  
  // Handle Decimal objects (check for toJSON method as well)
  if (obj instanceof Decimal || (obj && typeof obj === 'object' && typeof obj.toJSON === 'function' && obj.constructor?.name === 'Decimal')) {
    return obj.toString();
  }
  
  // Handle Date objects
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => serializeProduct(item));
  }
  
  // Handle plain objects
  if (typeof obj === 'object' && obj.constructor === Object) {
    const serialized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        serialized[key] = serializeProduct(obj[key]);
      }
    }
    return serialized;
  }
  
  // Handle other objects (like Prisma models)
  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const key in obj) {
      try {
        const value = obj[key];
        serialized[key] = serializeProduct(value);
      } catch (error) {
        // Skip problematic properties
        console.warn(`Skipping property ${key} during serialization:`, error);
      }
    }
    return serialized;
  }
  
  return obj;
}