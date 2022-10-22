import { strict as assert } from 'node:assert';
import type { PineconeClient } from '../src/index';

export const NAMESPACE = 'pinecone-fetch-e2e';

export type Metadata = {
  count: number;
  tags?: string[] | null;
  approved?: boolean;
};

/**
 * Minimal E2E tests until I setup a proper test suite.
 * Run by the native and polyfilled test files.
 */
export async function e2eTests(pinecone: PineconeClient<Metadata>) {
  const vectors = {
    1: {
      id: '1',
      values: [1, 1, 1, 1],
      metadata: { count: 1, tags: ['a', 'b'], approved: true },
    },
    2: {
      id: '2',
      values: [2, 2, 2, 2],
      metadata: { count: 2, tags: ['b', 'c'], approved: false },
    },
  };

  // Clear the namespace before starting
  await pinecone.delete({ deleteAll: true });

  // Basic upsert
  await pinecone.upsert({ vectors: [vectors[1], vectors[2]] });

  // Verify upsert with fetch
  const r1 = await pinecone.fetch({ ids: ['1', '2'] });
  assert(r1.namespace === NAMESPACE, 'namespace should match');
  assert(Object.keys(r1.vectors).length === 2, 'Expected 2 vectors');
  assert.deepStrictEqual(r1.vectors['1'], vectors[1], 'Vector 1 should match');
  assert.deepStrictEqual(r1.vectors['2'], vectors[2], 'Vector 2 should match');

  // Query by vector
  const r2 = await pinecone.query({
    topK: 2,
    vector: [3, 3, 3, 3],
  });
  assert(r2.namespace === NAMESPACE, 'namespace should match');
  // @ts-expect-error
  assert(r2.matches[0].metadata === undefined, 'metadata should be undefined');
  // @ts-expect-error - they return an empty array for some reason
  assert(r2.matches[0].values.length === 0, 'values should be []');
  assert(r2.matches.length === 2, 'Expected 2 matches');
  assert(
    typeof r2.matches[0].score === 'number',
    'Expected score to be a number'
  );
  assert(
    typeof r2.matches[1].score === 'number',
    'Expected score to be a number'
  );

  // Query by vector id
  const r3 = await pinecone.query({
    topK: 2,
    id: '2',
  });
  // @ts-expect-error
  assert(r2.matches[0].metadata === undefined, 'metadata should be undefined');
  // @ts-expect-error - they return an empty array for some reason
  assert(r2.matches[0].values.length === 0, 'values should be []');
  assert(r3.matches.length === 2, 'Expected 2 matches');

  // Query by vector id with smaller topK
  const r4 = await pinecone.query({
    topK: 1,
    id: '2',
  });
  assert(r4.matches.length === 1, 'Expected 1 matches');

  // Query by vector id with metadata
  const r5 = await pinecone.query({
    topK: 2,
    id: '2',
    includeMetadata: true,
  });
  // @ts-expect-error - they return an empty array for some reason
  assert(r5.matches[0].values.length === 0, 'values should be []');
  const v1 = r5.matches.find((v) => v.id === '1');
  assert(v1?.id === '1', 'Expected id to be 1');
  assert.deepStrictEqual(
    v1?.metadata,
    vectors[1].metadata,
    'Metadata should match'
  );

  // Query by vector id with vector values
  const r6 = await pinecone.query({
    topK: 2,
    id: '2',
    includeValues: true,
  });
  // @ts-expect-error
  assert(r2.matches[0].metadata === undefined, 'metadata should be undefined');
  const v2 = r6.matches.find((v) => v.id === '1');
  assert(v2?.id === '1', 'Expected id to be 1');
  assert.deepStrictEqual(v2.values, vectors[1].values, 'Values should match');

  // Query by vector id with vector values and metadata
  const r7 = await pinecone.query({
    topK: 2,
    id: '2',
    includeValues: true,
    includeMetadata: true,
  });
  const v3 = r7.matches.find((v) => v.id === '1');
  assert(v3?.id === '1', 'Expected id to be 1');
  assert.deepStrictEqual(v3.values, vectors[1].values, 'Values should match');
  assert.deepStrictEqual(
    v3?.metadata,
    vectors[1].metadata,
    'Metadata should match'
  );

  // Query with filter: simple
  const r8 = await pinecone.query({
    topK: 2,
    vector: [3, 3, 3, 3],
    filter: { count: 1 },
  });
  assert(r8.matches.length === 1, 'Expected 1 matches');

  // Query with filter: advanced
  const r9 = await pinecone.query({
    topK: 2,
    vector: [3, 3, 3, 3],
    filter: {
      count: { $gte: 1 },
      tags: { $in: ['a'] },
    },
  });
  assert(r9.matches.length === 1, 'Expected 1 matches');

  // Query with filter: null value
  const r10 = await pinecone.query({
    topK: 2,
    vector: [3, 3, 3, 3],
    filter: {
      count: { $lte: 1 },
      tags: null,
    },
  });
  assert(r10.matches.length === 1, 'Expected 1 matches');

  // Describe index stats
  const r11 = await pinecone.describeIndexStats();
  assert(r11.dimension === 4, 'Expected dimension to be 4');
  assert.deepStrictEqual(
    r11.namespaces[NAMESPACE],
    { vectorCount: 2 },
    'Expected namespace object to match'
  );

  // Update vector values
  await pinecone.update({
    id: '1',
    values: [11, 11, 11, 11],
  });
  const r12 = await pinecone.fetch({ ids: ['1'] });
  assert.deepStrictEqual(
    r12.vectors['1'].values,
    [11, 11, 11, 11],
    'Values should be updated'
  );

  // Update vector metadata
  // null value shouldn't throw and should be ignored
  await pinecone.update({
    id: '1',
    setMetadata: { count: 11, tags: null },
  });
  const r13 = await pinecone.fetch({ ids: ['1'] });
  assert.deepStrictEqual(
    r13.vectors['1'].metadata,
    {
      count: 11,
      tags: ['a', 'b'],
      approved: true,
    },
    'Metadata should be udpated'
  );

  // Upsert with null metadata
  await pinecone.upsert({
    vectors: [
      {
        id: '3',
        values: [3, 3, 3, 3],
        metadata: { count: 3, tags: null, approved: false },
      },
    ],
  });
  const r14 = await pinecone.fetch({ ids: ['3'] });
  assert.deepStrictEqual(
    r14.vectors['3'],
    {
      id: '3',
      values: [3, 3, 3, 3],
      metadata: { count: 3, approved: false },
    },
    'Upserted vector is correct'
  );

  // Delete a vector
  await pinecone.delete({ ids: ['1'] });
  const r15 = await pinecone.query({
    topK: 3,
    vector: [3, 3, 3, 3],
  });
  assert(r15.matches.length === 2, 'Expected 2 matches');
  const deletedVector = r15.matches.find((v) => v.id === '1');
  assert(deletedVector === undefined, 'Deleted vector should not be returned');

  // Delete all vectors
  await pinecone.delete({ deleteAll: true });
  const r16 = await pinecone.query({
    topK: 3,
    vector: [3, 3, 3, 3],
  });
  assert(r16.matches.length === 0, 'Expected all vectors to be deleted');
}
