import fetch from 'cross-fetch';
import { PineconeClient } from '../src/index';
import type { Metadata } from './e2e-tests';
import { NAMESPACE, e2eTests } from './e2e-tests';

/**
 * This runs the E2E tests against the polyfilled fetch implementation.
 * The env vars need to be set to run the tests locally.
 */
const pinecone = new PineconeClient<Metadata>({
  namespace: NAMESPACE,
  fetch,
});

e2eTests(pinecone);
