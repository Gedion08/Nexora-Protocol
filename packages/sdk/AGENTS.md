# SDK Development Guide

## Quick Start

```bash
cd packages/sdk
pnpm install
pnpm test      # run tests with coverage
pnpm typecheck # typecheck source + tests
pnpm lint      # run linter
pnpm build     # compile to dist/
```

## Project Structure

```
src/
  constants.ts       # Chain IDs, pool addresses, RPC URLs, timeouts
  types.ts           # TypeScript interfaces (ShieldParams, ShieldedNote, etc.)
  index.ts           # Public API exports
  utils/
    errors.ts        # NexoraError hierarchy with ErrorCode enum
    poseidon.ts      # Poseidon hashing, viewing key derivation, hex utilities
  core/
    abis.ts          # Contract ABIs (PrivacyHub, STRK20 Pool)
    client.ts        # PoolClient, PrivacyHubClient (contract interaction layer)
  privacy/
    viewing-key.ts   # ViewingKey class, ViewingKeyManager
    shield.ts        # ShieldBuilder (shield tokens)
    unshield.ts      # UnshieldBuilder (unshield tokens)
    discovery.ts     # NoteDiscovery, IndexerDiscoveryProvider
    prover.ts        # ProvingService (zero-knowledge proof generation)
tests/
  *.test.ts          # Unit tests (vitest)
```

## Key Conventions

- BigInts are used throughout for amounts and cryptographic values
- Hex strings include `0x` prefix
- Error codes use the `ErrorCode` enum (string values), checked via `isErrorCode()`
- Contract method calls use snake_case (e.g., `supports_token`, `register_viewing_key`)
- Receipt properties are normalized to camelCase in `TransactionReceipt`
- All contract calls wrap errors in appropriate `*Error` subclasses

## Testing

- Run: `pnpm test`
- Coverage thresholds: lines 85%, functions 85%, branches 80%, statements 85%
- Mock `starknet` module for client tests using `vi.mock('starknet', ...)`
- Mock `fetch` globally for prover and discovery tests using `vi.stubGlobal('fetch', ...)`
- Always call `vi.restoreAllMocks()` in `beforeEach` for test isolation

## TypeScript

- `tsconfig.json` - source compilation settings
- `tsconfig.test.json` - test file compilation (includes test types)
- `pnpm typecheck` checks both source and test files

## Dependencies

- `starknet` v6.x - Starknet.js for blockchain interaction
- `vitest` - Test runner and assertions
- `typescript` - Compilation and type checking
- `xo` - Linting
- `eslint` - Additional linting rules
