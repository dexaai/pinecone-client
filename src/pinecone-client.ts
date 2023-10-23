import type { FetchOptions } from './fetch-api.js';
import { createApiInstance } from './fetch-api.js';
import { removeNullValues } from './utils.js';
import type {
  RootMetadata,
  QueryParams,
  Filter,
  Vector,
  QueryResults,
  SparseValues,
} from './types.js';
import type { JsonObject, SetRequired } from 'type-fest';

type ConfigOpts = {
  /**
   * The API key used to authenticate with the Pinecone API.
   * Get yours from the Pinecone console: https://app.pinecone.io/
   */
  apiKey?: string;
  /**
   * The HTTP endpoint for the Pinecone index.
   * Use an empty string if there is no baseUrl yet because the index is being created.
   * @see https://www.pinecone.io/docs/manage-data/#specify-an-index-endpoint
   */
  baseUrl?: string;
  /**
   * The index namespace to use for all requests. This can't be changed after
   * the client is created to ensure metadata type safety.
   * @see https://www.pinecone.io/docs/namespaces/
   */
  namespace?: string;
  /**
   * Fetch options that will be added to all requests (like credentials, etc.).
   */
  fetchOptions?: FetchOptions;
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
    const process = globalThis.process || { env: {} };
    const apiKey = config.apiKey || process.env['PINECONE_API_KEY'];
    const baseUrl = config.baseUrl || process.env['PINECONE_BASE_URL'];
    if (!apiKey) {
      throw new Error(
        'Missing Pinecone API key. Please provide one in the config or set the PINECONE_API_KEY environment variable.',
      );
    }
    if (!baseUrl) {
      throw new Error(
        'Missing Pinecone base URL. Please provide one in the config or set the PINECONE_BASE_URL environment variable.',
      );
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.namespace = config.namespace;
    this.api = createApiInstance({
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      fetchOptions: config.fetchOptions,
    });
  }

  /**
   * The Delete operation deletes vectors, by id, from a single namespace. You
   * can delete items by their id, from a single namespace.
   * @param params.ids The ids of the vectors to delete.
   * @param params.deleteAll Deletes all vectors in the index if true.
   * @param params.filter Metadata filter to apply to the delete.
   * @see https://docs.pinecone.io/reference/delete/
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
   * @see https://docs.pinecone.io/reference/describe_index_stats_post
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
   * @see https://docs.pinecone.io/reference/fetch
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
   * @param params.minScore Filter out results with a score below this value.
   * @param params.filter Metadata filter to apply to the query.
   * @param params.id The id of the vector in the index to be used as the query vector.
   * @param params.vector A dense vector to be used as the query vector.
   * @param params.sparseVector A sparse vector to be used as the query vector.
   * @param params.hybridAlpha Dense vs sparse weighting. 0.0 is all sparse, 1.0 is all dense.
   * @param params.includeMetadata Whether to include metadata in the results.
   * @param params.includeValues Whether to include vector values in the results.
   * @note One of `vector` or `id` is required.
   * @see https://docs.pinecone.io/reference/query
   */
  async query<Params extends QueryParams<Metadata>>(
    params: Params,
  ): Promise<QueryResults<Metadata, Params>> {
    const { hybridAlpha, minScore, ...restParams } = params;
    // Apply hybrid scoring if requested.
    if (hybridAlpha != undefined) {
      const { vector, sparseVector } = params;
      if (!vector || !sparseVector) {
        throw new Error(
          `Hybrid queries require vector and sparseVector parameters.`,
        );
      }
      const weighted = hybridScoreNorm(vector, sparseVector, hybridAlpha);
      restParams.vector = weighted.values;
      restParams.sparseVector = weighted.sparseValues;
    }
    const results: QueryResults<Metadata, Params> = await this.api
      .post('query', {
        json: {
          namespace: this.namespace,
          ...removeNullValues(restParams),
        },
      })
      .json();
    // Filter out results below the minimum score.
    if (typeof minScore === 'number') {
      results.matches = results.matches.filter((r) => r.score >= minScore);
    }
    return results;
  }

  /**
   * The Update operation updates vector in a namespace. If a value is
   * included, it will overwrite the previous value. If a set_metadata
   * is included, the values of the fields specified in it will be added
   * or overwrite the previous value.
   * @param params.id The id of the vector to update.
   * @param params.values The new dense vector values.
   * @param params.sparseValues The new sparse vector values.
   * @param params.setMetadata Metadata to set for the vector.
   * @see https://docs.pinecone.io/reference/update
   */
  async update(params: {
    id: string;
    values?: number[];
    sparseValues?: SparseValues;
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
   * @see https://docs.pinecone.io/reference/upsert
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

  /**
   * This operation creates a Pinecone index. You can use it to specify the measure of similarity, the dimension of vectors to be stored in the index, the numbers of shards and replicas to use, and more.
   * @param params.environment The environment to create the index in. Eg: us-east-1-aws or us-west1-gcp
   * @param params.name The name of the index to be created. The maximum length is 45 characters.
   * @param params.dimension The dimensions of the vectors to be inserted in the index
   * @param params.metric The distance metric to be used for similarity search. You can use 'euclidean', 'cosine', or 'dotproduct'.
   * @param params.pods The number of pods for the index to use,including replicas.
   * @param params.replicas The number of replicas. Replicas duplicate your index. They provide higher availability and throughput.
   * @param params.shards The number of shards to be used in the index.
   * @param params.pod_type The type of pod to use. One of s1, p1, or p2 appended with . and one of x1, x2, x4, or x8.
   * @param params.metadata_config Configuration for the behavior of Pinecone's internal metadata index. By default, all metadata is indexed; when metadata_config is present, only specified metadata fields are indexed.
   * @param params.source_collection The name of the collection to create an index from.
   * @see https://docs.pinecone.io/reference/create_index
   */
  async createIndex(params: {
    environment: string;
    name: string;
    dimension: number;
    metric?: 'euclidean' | 'cosine' | 'dotproduct';
    pods?: number;
    replicas?: number;
    shards?: number;
    pod_type?: string;
    metadata_config?: JsonObject;
    source_collection?: string;
  }): Promise<void> {
    const { environment, ...rest } = params;
    const indexApi = this.api.extend({
      prefixUrl: `https://controller.${environment}.pinecone.io`,
    });
    await indexApi.post('databases', { json: rest });
  }

  /**
   * This operation deletes an existing index.
   * @param params.environment The environment the index is in. Eg: us-east-1-aws or us-west1-gcp
   * @param params.name The name of the index to delete.
   * @see https://docs.pinecone.io/reference/delete_index
   */
  async deleteIndex(params: {
    environment: string;
    name: string;
  }): Promise<void> {
    const { environment, name } = params;
    const indexApi = this.api.extend({
      prefixUrl: `https://controller.${environment}.pinecone.io`,
    });
    await indexApi.delete(`databases/${name}`);
  }
}

/**
 * Hybrid score using a convex combination: alpha * dense + (1 - alpha) * sparse
 * @see: https://docs.pinecone.io/docs/hybrid-search#sparse-dense-queries-do-not-support-explicit-weighting
 */
function hybridScoreNorm(
  dense: number[],
  sparse: SparseValues,
  alpha: number,
): {
  values: number[];
  sparseValues: SparseValues;
} {
  if (alpha < 0 || alpha > 1) {
    throw new Error('Alpha must be between 0 and 1');
  }
  const sparseValues: SparseValues = {
    indices: sparse.indices,
    values: sparse.values.map((v) => v * (1 - alpha)),
  };
  const values: number[] = dense.map((v) => v * alpha);
  return { values, sparseValues };
}
