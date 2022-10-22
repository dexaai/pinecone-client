/**
 * This version of the client is for environments that support fetch natively.
 * See /fetch-polyfill for a version that works in environments that don't.
 */
export { PineconeClient } from './pinecone-client';

export type { Filter, Vector, QueryParams, QueryResults } from './types';
