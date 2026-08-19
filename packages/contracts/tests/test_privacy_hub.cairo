use starknet::ContractAddress;
use snforge_std::{
    declare,
    ContractClassTrait,
    DeclareResultTrait,
    start_cheat_caller_address_global,
    start_mock_call,
    spy_events,
    EventSpyAssertionsTrait,
};

use nexora_contracts::nexora_privacy_hub::nexora_privacy_hub::{
    INexoraPrivacyHubDispatcher,
    INexoraPrivacyHubDispatcherTrait,
    Shielded,
};

use crate::mock_strk20_pool::{
    IMockStrk20PoolDispatcher,
    IMockStrk20PoolDispatcherTrait,
};

fn felt_address(value: felt252) -> ContractAddress {
    value.try_into().unwrap()
}

fn admin() -> ContractAddress {
    felt_address('admin')
}

fn user() -> ContractAddress {
    felt_address('user')
}

fn token() -> ContractAddress {
    felt_address('token')
}

fn recipient() -> ContractAddress {
    felt_address('recipient')
}

fn to() -> ContractAddress {
    felt_address('to')
}

/// Deploys the PrivacyHub pointing at a freshly deployed mock pool.
/// Returns (hub, mock_pool, hub_address).
fn deploy_hub() -> (INexoraPrivacyHubDispatcher, IMockStrk20PoolDispatcher, ContractAddress) {
    let pool_class = declare("mock_strk20_pool").unwrap().contract_class();
    let (pool_address, _) = pool_class.deploy(@array![]).unwrap();

    let hub_class = declare("nexora_privacy_hub").unwrap().contract_class();
    let calldata = array![admin().into(), pool_address.into()];
    let (hub_address, _) = hub_class.deploy(@calldata).unwrap();

    let hub = INexoraPrivacyHubDispatcher { contract_address: hub_address };
    let pool = IMockStrk20PoolDispatcher { contract_address: pool_address };

    (hub, pool, hub_address)
}

fn add_token(hub: INexoraPrivacyHubDispatcher, token: ContractAddress) {
    start_cheat_caller_address_global(admin());
    hub.add_supported_token(token);
}

/// Mock the ERC20 `transfer_from` the hub performs during shield.
fn mock_erc20_transfer(token: ContractAddress) {
    start_mock_call(token, selector!("transfer_from"), ());
}

#[test]
fn test_shield_forwards_proof_to_pool() {
    let (hub, pool, hub_address) = deploy_hub();
    add_token(hub, token());
    mock_erc20_transfer(token());

    start_cheat_caller_address_global(user());
    hub.register_viewing_key(98765);

    let mut spy = spy_events();
    let amount: u256 = 1_000_000;
    let proof = array![0xaa, 0xbb];
    hub.shield(token(), amount, proof);

    assert(pool.get_shield_calls() == 1, 'shield not forwarded');
    assert(pool.get_last_shield_token() == token(), 'wrong token');
    assert(pool.get_last_shield_amount() == amount, 'wrong amount');
    assert(pool.get_last_shield_user() == user(), 'wrong user');
    assert(pool.get_last_shield_viewing_key() == 98765, 'wrong viewing key');
    assert(pool.get_shield_proof_len() == 2, 'proof not forwarded');
    assert(pool.get_shield_proof_at(0) == 0xaa, 'proof[0] wrong');
    assert(pool.get_shield_proof_at(1) == 0xbb, 'proof[1] wrong');

    spy.assert_emitted(
        @array![(
            hub_address,
            Shielded { user: user(), token: token(), amount, note_hash: 101 },
        )],
    );

    let received = spy.get_events();
    for (from, event) in received.events.span() {
        snforge_std::PrintTrait::print(from);
        snforge_std::PrintTrait::print(event.keys);
        snforge_std::PrintTrait::print(event.data);
    };
}

#[test]
fn test_shield_forwards_empty_proof_when_none_supplied() {
    let (hub, pool, _hub_address) = deploy_hub();
    add_token(hub, token());
    mock_erc20_transfer(token());

    start_cheat_caller_address_global(user());

    let amount: u256 = 5_000;
    hub.shield(token(), amount, array![]);

    assert(pool.get_shield_calls() == 1, 'shield not forwarded');
    assert(pool.get_shield_proof_len() == 0, 'expected empty proof');
}

#[test]
fn test_unshield_forwards_proof_to_pool() {
    let (hub, pool, _hub_address) = deploy_hub();
    add_token(hub, token());

    start_cheat_caller_address_global(user());
    let amount: u256 = 2_500;
    let proof = array![0xcc, 0xdd, 0xee];
    hub.unshield(token(), amount, recipient(), proof);

    assert(pool.get_unshield_calls() == 1, 'unshield not forwarded');
    assert(pool.get_last_unshield_token() == token(), 'wrong token');
    assert(pool.get_last_unshield_amount() == amount, 'wrong amount');
    assert(pool.get_last_unshield_recipient() == recipient(), 'wrong recipient');
    assert(pool.get_unshield_proof_len() == 3, 'proof not forwarded');
    assert(pool.get_unshield_proof_at(0) == 0xcc, 'proof[0] wrong');
    assert(pool.get_unshield_proof_at(2) == 0xee, 'proof[2] wrong');
}

#[test]
#[should_panic(expected: 'EMPTY_PROOF')]
fn test_unshield_rejects_empty_proof() {
    let (hub, _pool, _hub_address) = deploy_hub();
    add_token(hub, token());

    start_cheat_caller_address_global(user());
    hub.unshield(token(), 100, recipient(), array![]);
}

#[test]
fn test_private_transfer_forwards_proof_to_pool() {
    let (hub, pool, _hub_address) = deploy_hub();
    add_token(hub, token());

    start_cheat_caller_address_global(user());
    let amount: u256 = 750;
    let proof = array![0x11];
    hub.private_transfer(to(), token(), amount, proof);

    assert(pool.get_transfer_calls() == 1, 'transfer not forwarded');
    assert(pool.get_last_transfer_to() == to(), 'wrong to');
    assert(pool.get_last_transfer_token() == token(), 'wrong token');
    assert(pool.get_last_transfer_amount() == amount, 'wrong amount');
    assert(pool.get_transfer_proof_len() == 1, 'proof not forwarded');
    assert(pool.get_transfer_proof_at(0) == 0x11, 'proof wrong');
}

#[test]
#[should_panic(expected: 'EMPTY_PROOF')]
fn test_private_transfer_rejects_empty_proof() {
    let (hub, _pool, _hub_address) = deploy_hub();
    add_token(hub, token());

    start_cheat_caller_address_global(user());
    hub.private_transfer(to(), token(), 100, array![]);
}

#[test]
fn test_register_viewing_key_forwards_to_pool() {
    let (hub, pool, _hub_address) = deploy_hub();

    start_cheat_caller_address_global(user());
    hub.register_viewing_key(123456789);

    assert(pool.get_register_viewing_key_calls() == 1, 'vk not forwarded');
    assert(pool.get_last_public_key() == 123456789, 'wrong public key');
    assert(hub.get_user_viewing_key(user()) == 123456789, 'vk not stored on hub');
}

#[test]
#[should_panic(expected: 'TOKEN_NOT_SUPPORTED')]
fn test_shield_rejects_unsupported_token() {
    let (hub, _pool, _hub_address) = deploy_hub();

    start_cheat_caller_address_global(user());
    let amount: u256 = 1_000;
    let proof = array![0x01];
    hub.shield(token(), amount, proof);
}