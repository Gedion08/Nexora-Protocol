export const PRIVACY_HUB_ABI = [
  {
    type: 'function',
    name: 'add_supported_token',
    inputs: [{ name: 'token', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'register_viewing_key',
    inputs: [{ name: 'public_key', type: 'core::felt252' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'shield',
    inputs: [
      { name: 'token', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'amount', type: 'core::integer::u256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'unshield',
    inputs: [
      { name: 'token', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'amount', type: 'core::integer::u256' },
      { name: 'recipient', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'proof', type: 'core::array::ArrayCore<core::felt252>' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'private_transfer',
    inputs: [
      { name: 'to', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'token', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'amount', type: 'core::integer::u256' },
      { name: 'proof', type: 'core::array::ArrayCore<core::felt252>' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'set_pool',
    inputs: [{ name: 'pool', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'set_admin',
    inputs: [{ name: 'admin', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [],
  },
] as const;

export const STRK20_POOL_ABI = [
  {
    type: 'function',
    name: 'register_viewing_key',
    inputs: [{ name: 'public_key', type: 'core::felt252' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'shield',
    inputs: [
      { name: 'token', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'amount', type: 'core::integer::u256' },
      { name: 'user', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'viewing_key', type: 'core::felt252' },
      { name: 'proof', type: 'core::array::ArrayCoreOutputs' },
    ],
    outputs: [{ name: 'note_hash', type: 'core::felt252' }],
  },
  {
    type: 'function',
    name: 'unshield',
    inputs: [
      { name: 'token', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'amount', type: 'core::integer::u256' },
      { name: 'recipient', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'proof', type: 'core::array::ArrayCoreOutputs' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'token', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'amount', type: 'core::integer::u256' },
      { name: 'proof', type: 'core::array::ArrayCoreOutputs' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'get_supports_token',
    inputs: [{ name: 'token', type: 'core::starknet::contract_address::ContractAddress' }],
    outputs: [{ name: 'supported', type: 'core::bool' }],
  },
  {
    type: 'function',
    name: 'get_nullifier_spent',
    inputs: [{ name: 'nullifier', type: 'core::felt252' }],
    outputs: [{ name: 'spent', type: 'core::bool' }],
  },
] as const;

export const EVENT_ABIS = [
  {
    type: 'event',
    name: 'Shielded',
    keys: [
      { name: 'user', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'token', type: 'core::starknet::contract_address::ContractAddress' },
    ],
    values: [
      { name: 'amount', type: 'core::integer::u256' },
      { name: 'note_hash', type: 'core::felt252' },
    ],
  },
  {
    type: 'event',
    name: 'Unshielded',
    keys: [
      { name: 'user', type: 'core::starknet::contract_address::ContractAddress' },
      { name: 'token', type: 'core::starknet::contract_address::ContractAddress' },
    ],
    values: [
      { name: 'amount', type: 'core::integer::u256' },
      { name: 'recipient', type: 'core::starknet::contract_address::ContractAddress' },
    ],
  },
  {
    type: 'event',
    name: 'ViewingKeyRegistered',
    keys: [{ name: 'user', type: 'core::starknet::contract_address::ContractAddress' }],
    values: [{ name: 'public_key', type: 'core::felt252' }],
  },
] as const;
