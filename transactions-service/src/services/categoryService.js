/**
 * Servicio de categorías y reglas de clasificación de gastos.
 */

export const DEFAULT_CATEGORIES = [
  'alimentacion',
  'transporte',
  'vivienda',
  'servicios',
  'ocio',
  'salud',
  'educacion',
  'otros'
];

// Mapeo de palabras clave para sugerencia de categoría automática.
// NOTA: Las keywords usan match de palabra completa (\bkw\b).
// Si necesitas cubrir plurales, agrégalos explícitamente (ej. 'libro' y 'libros').
const KEYWORD_MAPPINGS = [
  { category: 'alimentacion', keywords: ['supermercado', 'restaurante', 'almuerzo', 'cena', 'comida', 'mercado', 'cafe', 'panaderia', 'super'] },
  { category: 'transporte', keywords: ['gasolina', 'combustible', 'uber', 'taxi', 'metro', 'bus', 'peaje', 'estacionamiento', 'pasaje'] },
  { category: 'vivienda', keywords: ['alquiler', 'arriendo', 'hipoteca', 'mantenimiento', 'reparacion', 'muebles'] },
  { category: 'servicios', keywords: ['luz', 'agua', 'internet', 'telefono', 'electricidad', 'streaming', 'netflix', 'spotify'] },
  { category: 'ocio', keywords: ['cine', 'fiesta', 'juegos', 'videojuegos', 'viaje', 'concierto', 'bar', 'cerveza', 'hobby'] },
  { category: 'salud', keywords: ['farmacia', 'medicamento', 'doctor', 'consulta', 'medico', 'dentista', 'optica', 'hospital'] },
  { category: 'educacion', keywords: ['curso', 'universidad', 'colegio', 'libro', 'libros', 'taller', 'matricula', 'clase'] }
];

export function getDefaultCategories() {
  return [...DEFAULT_CATEGORIES];
}

export function normalizeCategory(category) {
  if (!category || typeof category !== 'string') return '';
  return category
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remover tildes para estandarización (ej. alimentación -> alimentacion)
}

export function isValidCategory(category) {
  const normalized = normalizeCategory(category);
  return Boolean(normalized && normalized.length >= 2 && normalized.length <= 50);
}

export function suggestCategory(description) {
  if (!description || typeof description !== 'string') return 'otros';
  // Normalizamos la descripción: sin tildes, minúsculas
  const cleanDesc = description
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  for (const { category, keywords } of KEYWORD_MAPPINGS) {
    // Match de palabra completa (\bkw\b) para evitar falsos positivos
    // (ej. 'gas' NO debe disparar dentro de 'gasto', 'super' NO dentro de 'supera')
    if (keywords.some((kw) => new RegExp(`\\b${kw}\\b`).test(cleanDesc))) {
      return category;
    }
  }

  return 'otros';
}
