import 'cross-fetch/polyfill';

/**
 * Import this version of the client from environments that don't support fetch
 * natively, such as Node.js 17 and below. The cross-fetch polyfill add fetch
 * to the global scope.
 */
import { PineconeClient } from '../pinecone-client';

export { PineconeClient };
