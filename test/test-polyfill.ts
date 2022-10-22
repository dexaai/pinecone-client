import { PineconeClient } from '../src/fetch-polyfill/index';
import type { Metadata } from './e2e-tests';
import { NAMESPACE, e2eTests } from './e2e-tests';

/**
 * This runs the E2E tests against the polyfilled fetch implementation.
 * The env vars need to be set to run the tests locally.
 */
const pinecone = new PineconeClient<Metadata>({
  namespace: NAMESPACE,
});

e2eTests(pinecone);
