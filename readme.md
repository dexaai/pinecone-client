# Unofficial Pinecone.io Client

[![Build Status](https://github.com/rileytomasek/pinecone-client/actions/workflows/main.yml/badge.svg)](https://github.com/rileytomasek/pinecone-client/actions/workflows/main.yml) [![npm version](https://img.shields.io/npm/v/pinecone-client.svg?color=0c0)](https://www.npmjs.com/package/pinecone-client)

An unofficial fetch based client for the [Pinecone.io](https://www.pinecone.io/) vector database with excellent TypeScript support.

Pinecone recently released a [similar client](https://github.com/pinecone-io/pinecone-ts-client). It's a great option if you aren't picky about fully typed metadata.

## Highlights

- Support for all vector operation endpoints
- Fully typed metadata with TypeScript generics
- Automatically remove null metadata values (Pinecone doesn't nulls)
- Supports modern fetch based runtimes (Cloudlflare workers, Deno, etc)
- In-editor documentation with IntelliSense/TS server
- Tiny package size. [Less than 5kb gzipped](https://bundlephobia.com/package/pinecone-client)
- Full [e2e test coverage](/test)

## Example Usage

```ts
import { PineconeClient } from 'pinecone-client';

// Specify the type of your metadata
type Metadata = { size: number, tags?: string[] | null };

// Instantiate a client
const pinecone = new PineconeClient<Metadata>({ namespace: 'test' });

// Upsert vectors with metadata.
await pinecone.upsert({
  vectors: [
    { id: '1', values: [1, 2, 3], metadata: { size: 3, tags: ['a', 'b', 'c'] } },
    { id: '2', values: [4, 5, 6], metadata: { size: 10, tags: null } },
  ],
});

// Query vectors with metadata filters.
const { matches } = await pinecone.query({
  topK: 2,
  id: '2',
  filter: { size: { $lt: 20 } },
  includeMetadata: true,
});

// typeof matches = {
//   id: string;
//   score: number;
//   metadata: Metadata;
// }[];
```

## Install

**Warning:** This package is native [ESM](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules) and no longer provides a CommonJS export. If your project uses CommonJS, you will have to [convert to ESM](https://gist.github.com/sindresorhus/a39789f98801d908bbc7ff3ecc99d99c) or use the [dynamic `import()`](https://v8.dev/features/dynamic-import) function. Please don't open issues for questions regarding CommonJS / ESM.

**Runtimes**
- Supported: Deno, Node v18+, Cloudflare Workers, browsers
- Unsupported: Anything without a native fetch implementation (Node<v17)

```sh
npm install pinecone-client
```

```ts
import { PineconeClient } from 'pinecone-client';

const pinecone = new PineconeClient({ /* ... */ });
```

## Setup

Once installed, you need to create an instance of the `PineconeClient` class to make API calls.

```ts
import { PineconeClient } from 'pinecone-client';

// A type representing your metadata
type Metadata = {};

const pinecone = new PineconeClient<Metadata>({
  apiKey: '<your api key>',
  baseUrl: '<your index url>',
  namespace: 'testing',
});
```

Both apiKey and baseUrl are optional and will be read from the following environment variables:
- `process.env.PINECONE_API_KEY`
- `process.env.PINECONE_BASE_URL`

## API

The client supports all of the vector operations from the Pinecone API using the same method names and parameters. It also supports creating and deleting indexes.

For detailed documentation with links to the Pinecone docs, see [the source code](/src/pinecone-client.ts).

### Supported methods:

- `pinecone.delete()`
- `pinecone.describeIndexStats()`
- `pinecone.fetch()`
- `pinecone.query()`
- `pinecone.update()`
- `pinecone.upsert()`
- `pinecone.createIndex()`
- `pinecone.deleteIndex()`

You can also find more example usage in the [e2e tests](/test/e2e-tests.ts).
