import { createApiInstance } from './fetch-api';
import { removeNullValues } from './utils';
import type {
  RootMetadata,
  QueryParams,
  Filter,
  Vector,
  QueryResults,
} from './types';
import type { SetRequired } from 'type-fest';

type ConfigOpts = {
  /**
   * The API key used to authenticate with the Pinecone API.
   * Get yours from the Pinecone console: https://app.pinecone.io/
   */
  apiKey?: string;
  /**
   * The HTTP endpoint for the Pinecone index.
   * @see https://www.pinecone.io/docs/manage-data/#specify-an-index-endpoint
   */
  baseUrl?: string;
  /**
   * The index namespace to use for all requests. This can't be changed after
   * the client is created to ensure metadata type safety.
   * @see https://www.pinecone.io/docs/namespaces/
   */
  namespace?: string;
};

/**
 * PineconeClient class used to interact with a Pinecone index.
 */
export class PineconeClient<Metadata extends RootMetadata> {
  api: ReturnType<typeof createApiInstance>;
  apiKey: string;
  baseUrl: string;
  namespace?: string;

  constructor(config: ConfigOpts) {
    const apiKey = config.apiKey || process.env.PINECONE_API_KEY;
    const baseUrl = config.baseUrl || process.env.PINECONE_BASE_URL;
    if (!apiKey) {
      throw new Error(
        'Missing Pinecone API key. Please provide one in the config or set the PINECONE_API_KEY environment variable.'
      );
    }
    if (!baseUrl) {
      throw new Error(
        'Missing Pinecone base URL. Please provide one in the config or set the PINECONE_BASE_URL environment variable.'
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.namespace = config.namespace;
    this.api = createApiInstance({
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
    });
  }

  /**
   * The Delete operation deletes vectors, by id, from a single namespace. You
   * can delete items by their id, from a single namespace.
   * @param params.ids The ids of the vectors to delete.
   * @param params.deleteAll Deletes all vectors in the index if true.
   * @param params.filter Metadata filter to apply to the delete.
   * @see https://www.pinecone.io/docs/api/operation/delete/
   */
  async delete(params: {
    ids?: string[];
    deleteAll?: boolean;
    filter?: Filter<Metadata>;
  }): Promise<void> {
    return this.api
      .post('vectors/delete', {
        json: {
          namespace: this.namespace,
          ...removeNullValues(params),
        },
      })
      .json();
  }

  /**
   * The DescribeIndexStats operation returns statistics about the index's
   * contents, including the vector count per namespace, the number of
   * dimensions, and the index fullness.
   * @params params.filter Metadata filter to apply to the describe.
   * @see https://www.pinecone.io/docs/api/operation/describe_index_stats/
   */
  async describeIndexStats(params?: { filter?: Filter<Metadata> }): Promise<{
    namespaces: { [namespace: string]: { vectorCount: number } };
    dimension: number;
    indexFullness: number;
    totalVectorCount: number;
  }> {
    return this.api
      .post('describe_index_stats', {
        json: removeNullValues(params),
      })
      .json();
  }

  /**
   * The Fetch operation looks up and returns vectors, by ID, from a single
   * namespace. The returned vectors include the vector data and/or metadata.
   * @param params.ids The ids of the vectors to fetch.
   * @see https://www.pinecone.io/docs/api/operation/fetch/
   */
  async fetch(params: { ids: string[] }): Promise<{
    namespace: string;
    vectors: { [vectorId: string]: Vector<Metadata> };
  }> {
    const searchParams: string[][] = [];
    if (this.namespace) searchParams.push(['namespace', this.namespace]);
    params.ids.forEach((id) => searchParams.push(['ids', id]));
    return this.api.get('vectors/fetch', { searchParams }).json();
  }

  /**
   * The Query operation searches a namespace, using a query vector. It
   * retrieves the ids of the most similar items in a namespace, along with
   * their similarity scores.
   * @param params.topK The number of results to return.
   * @param params.filter Metadata filter to apply to the query.
   * @param params.id The id of the vector in the index to be used as the query vector.
   * @param params.vector A vector to be used as the query vector.
   * @param params.includeMetadata Whether to include metadata in the results.
   * @param params.includeValues Whether to include vector values in the results.
   * @note One of `vector` or `id` is required.
   * @see https://www.pinecone.io/docs/api/operation/query/
   */
  async query<Params extends QueryParams<Metadata>>(
    params: Params
  ): Promise<QueryResults<Metadata, Params>> {
    return this.api
      .post('query', {
        json: {
          namespace: this.namespace,
          ...removeNullValues(params),
        },
      })
      .json();
  }

  /**
   * The Update operation updates vector in a namespace. If a value is
   * included, it will overwrite the previous value. If a set_metadata
   * is included, the values of the fields specified in it will be added
   * or overwrite the previous value.
   * @param params.id The id of the vector to update.
   * @param params.values The new vector values.
   * @param params.setMetadata Metadata to set for the vector.
   * @see https://www.pinecone.io/docs/api/operation/update/
   */
  async update(params: {
    id: string;
    values?: number[];
    setMetadata?: Metadata;
  }): Promise<void> {
    return this.api
      .post('vectors/update', {
        json: {
          namespace: this.namespace,
          ...removeNullValues(params),
        },
      })
      .json();
  }

  /**
   * The Upsert operation writes vectors into a namespace. If a new value is
   * upserted for an existing vector id, it will overwrite the previous value.
   * @param params.vectors The vectors to upsert.
   * @param params.batchSize The number of vectors to upsert in each batch.
   * @note This will automatically chunk the requests into batches of 1000 vectors.
   * @see https://www.pinecone.io/docs/api/operation/upsert/
   */
  async upsert(params: {
    vectors: SetRequired<Vector<Metadata>, 'metadata'>[];
    batchSize?: number;
  }): Promise<void> {
    // Don't upsert more than `params.batchSize` vectors in a single request
    const batchSize = params.batchSize || 50;
    for (let i = 0; i < params.vectors.length; i += batchSize) {
      const vectors = params.vectors.slice(i, i + batchSize);
      const vectorsWithoutMetadataNulls = vectors.map(removeNullValues);
      await this.api
        .post('vectors/upsert', {
          json: {
            namespace: this.namespace,
            vectors: vectorsWithoutMetadataNulls,
          },
        })
        .json();
    }
  }
}
