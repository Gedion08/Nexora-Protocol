import { Pool, PoolClient } from 'pg';
import type { QueryResult, QueryResultRow } from 'pg';
import type { RelayerConfig } from '@nexora-protocol/shared';

export class Database {
  private pool: Pool;
  private config: RelayerConfig;

  constructor(config: RelayerConfig) {
    this.config = config;
    this.pool = new Pool({
      connectionString: config.dbUrl,
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    this.pool.on('error', (err) => {
      console.error('Unexpected database error:', err);
    });

    this.pool.on('connect', () => {
      console.debug('Database client connected');
    });
  }

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async query<T extends QueryResultRow = QueryResultRow>(text: string, params?: any[]): Promise<QueryResult<T>> {
    const start = Date.now();
    const result = await this.pool.query<T>(text, params);
    const elapsed = Date.now() - start;
    console.debug('Query executed', { text: text.substring(0, 80), elapsedMs: elapsed, rows: result.rowCount });
    return result;
  }

  async executeInTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  getConfig(): RelayerConfig {
    return this.config;
  }
}

export type { PoolClient, QueryResult };
