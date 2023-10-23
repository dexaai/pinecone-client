import type { NoNullParams, RootMetadata } from './types.js';

/**
 * Recursively remove keys with null values from an object.
 * Also handles accepting undefined to prevent repeating this logic at each call site.
 */
export function removeNullValuesFromObject<T extends {}>(
  obj?: T
): T | undefined {
  if (obj === undefined) return undefined;
  for (const key in obj) {
    const value = obj[key];
    if (value === null) delete obj[key];
    else if (typeof value == 'object') removeNullValuesFromObject(value);
  }
  return obj;
}

/**
 * This remove null values from the metadata and filter properties of the given
 * object. This makes it easier to work with Pinecones lack of support for null.
 */
export function removeNullValues<
  Metadata extends RootMetadata,
  T extends NoNullParams<Metadata>
>(obj: T | undefined): T | undefined {
  if (obj === undefined) return undefined;
  const { metadata, filter, setMetadata, ...rest } = obj;
  return {
    filter: removeNullValuesFromObject(filter),
    metadata: removeNullValuesFromObject(metadata),
    setMetadata: removeNullValuesFromObject(setMetadata),
    ...rest,
  } as T;
}
