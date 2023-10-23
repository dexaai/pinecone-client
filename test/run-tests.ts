import { PineconeClient } from '../src/index.js';
import type { Metadata } from './e2e-tests.js';
import { NAMESPACE, e2eTests } from './e2e-tests.js';

/**
 * This runs the E2E tests against a real Pinecone instance.
 * The env vars need to be set to run the tests locally.
 */
async function main() {
  try {
    const pinecone = new PineconeClient<Metadata>({ namespace: NAMESPACE });
    await e2eTests(pinecone);
    console.log('E2E tests passed');
    process.exit(0);
  } catch (e) {
    console.error('E2E tests failed', e);
    process.exit(1);
  }
}

main();
