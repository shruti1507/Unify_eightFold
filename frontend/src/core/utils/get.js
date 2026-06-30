/**
 * Dynamically retrieves a value from a nested object using a path string.
 * Supports both dot notation (foo.bar) and bracket notation (foo[0].bar).
 * 
 * @param {Object} obj - The object to query
 * @param {string} path - The path of the property to get
 * @param {*} defaultValue - The value returned if the resolved value is undefined
 * @returns {*}
 */
export function get(obj, path, defaultValue = undefined) {
  if (!obj || !path) return defaultValue;

  // Replace bracket notation with dot notation: 'foo[0].bar' -> 'foo.0.bar'
  const normalizedPath = path.replace(/\[(\w+)\]/g, '.$1').replace(/^\./, '');
  const keys = normalizedPath.split('.');

  let current = obj;
  for (const key of keys) {
    if (current === undefined || current === null) return defaultValue;
    current = current[key];
  }

  return current !== undefined ? current : defaultValue;
}
