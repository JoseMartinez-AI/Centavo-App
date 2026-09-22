/**
 * Servicio de categorías y normalización para presupuestos en Centavo.
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
