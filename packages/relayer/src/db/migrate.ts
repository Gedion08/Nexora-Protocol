import { Database } from './connection';
import { DROP_SCHEMA_SQL, MIGRATIONS } from './schema';

export interface MigrationRecord {
  id: string;
  name: string;
  applied_at: Date;
}

export class MigrationRunner {
  constructor(private db: Database) {}

  async ensureMigrationsTable(): Promise<void> {
    await this.db.query(`
      CREATE TABLE IF NOT EXISTS nexora.migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  async getAppliedMigrations(): Promise<MigrationRecord[]> {
    const result = await this.db.query<MigrationRecord>(
      'SELECT name, applied_at FROM nexora.migrations ORDER BY id ASC'
    );
    return result.rows;
  }

  async applyMigration(client: any, name: string, sql: string): Promise<void> {
    await client.query(sql);
    await client.query('INSERT INTO nexora.migrations (name) VALUES ($1)', [name]);
  }

  async up(): Promise<{ applied: string[]; alreadyApplied: string[] }> {
    await this.ensureMigrationsTable();
    const applied = await this.getAppliedMigrations();
    const appliedNames = new Set(applied.map((m) => m.name));

    const toApply = MIGRATIONS.filter((m) => !appliedNames.has(m.name));

    const appliedNames_: string[] = [];
    for (const migration of toApply) {
      await this.db.executeInTransaction(async (client) => {
        await this.applyMigration(client, migration.name, migration.sql);
      });
      appliedNames_.push(migration.name);
      console.log(`Applied migration: ${migration.name}`);
    }

    return {
      applied: appliedNames_,
      alreadyApplied: Array.from(appliedNames),
    };
  }

  async down(): Promise<void> {
    await this.db.executeInTransaction(async (client) => {
      await client.query(DROP_SCHEMA_SQL);
    });
    console.log('Schema dropped');
  }

  async reset(): Promise<void> {
    await this.down();
    const result = await this.up();
    console.log(`Reset complete. Applied ${result.applied.length} migrations.`);
  }

  async run(): Promise<void> {
    const args = process.argv.slice(2);
    const shouldReset = args.includes('--reset');

    if (shouldReset) {
      await this.reset();
    } else {
      await this.up();
    }

    await this.db.close();
    process.exit(0);
  }
}
