use starknet::ContractAddress;

/// Mirrors the `IStrt20Pool` interface the PrivacyHub dispatches to, so the mock
/// can observe exactly what the hub forwards.
#[starknet::interface]
pub trait IMockStrk20Pool<TContractState> {
    fn register_viewing_key(ref self: TContractState, public_key: felt252);
    fn shield(
        ref self: TContractState,
        token: ContractAddress,
        amount: u256,
        user: ContractAddress,
        viewing_key: felt252,
        proof: Array<felt252>,
    ) -> felt252;
    fn unshield(
        ref self: TContractState,
        token: ContractAddress,
        amount: u256,
        recipient: ContractAddress,
        proof: Array<felt252>,
    );
    fn transfer(
        ref self: TContractState,
        to: ContractAddress,
        token: ContractAddress,
        amount: u256,
        proof: Array<felt252>,
    );
    fn get_register_viewing_key_calls(self: @TContractState) -> u128;
    fn get_last_public_key(self: @TContractState) -> felt252;
    fn get_shield_calls(self: @TContractState) -> u128;
    fn get_last_shield_token(self: @TContractState) -> ContractAddress;
    fn get_last_shield_amount(self: @TContractState) -> u256;
    fn get_last_shield_user(self: @TContractState) -> ContractAddress;
    fn get_last_shield_viewing_key(self: @TContractState) -> felt252;
    fn get_shield_proof_len(self: @TContractState) -> u128;
    fn get_shield_proof_at(self: @TContractState, index: u128) -> felt252;
    fn get_unshield_calls(self: @TContractState) -> u128;
    fn get_last_unshield_token(self: @TContractState) -> ContractAddress;
    fn get_last_unshield_amount(self: @TContractState) -> u256;
    fn get_last_unshield_recipient(self: @TContractState) -> ContractAddress;
    fn get_unshield_proof_len(self: @TContractState) -> u128;
    fn get_unshield_proof_at(self: @TContractState, index: u128) -> felt252;
    fn get_transfer_calls(self: @TContractState) -> u128;
    fn get_last_transfer_to(self: @TContractState) -> ContractAddress;
    fn get_last_transfer_token(self: @TContractState) -> ContractAddress;
    fn get_last_transfer_amount(self: @TContractState) -> u256;
    fn get_transfer_proof_len(self: @TContractState) -> u128;
    fn get_transfer_proof_at(self: @TContractState, index: u128) -> felt252;
}

#[starknet::contract]
pub mod mock_strk20_pool {
    use starknet::ContractAddress;
    use starknet::storage::{
        Map, StoragePointerReadAccess, StoragePointerWriteAccess, StorageMapReadAccess,
        StorageMapWriteAccess,
    };
    use super::IMockStrk20Pool;

    #[storage]
    struct Storage {
        register_viewing_key_calls: u128,
        last_public_key: felt252,
        shield_calls: u128,
        last_shield_token: ContractAddress,
        last_shield_amount: u256,
        last_shield_user: ContractAddress,
        last_shield_viewing_key: felt252,
        last_shield_proof_len: u128,
        last_shield_proof: Map<u128, felt252>,
        unshield_calls: u128,
        last_unshield_token: ContractAddress,
        last_unshield_amount: u256,
        last_unshield_recipient: ContractAddress,
        last_unshield_proof_len: u128,
        last_unshield_proof: Map<u128, felt252>,
        transfer_calls: u128,
        last_transfer_to: ContractAddress,
        last_transfer_token: ContractAddress,
        last_transfer_amount: u256,
        last_transfer_proof_len: u128,
        last_transfer_proof: Map<u128, felt252>,
    }

    #[abi(embed_v0)]
    impl MockPoolImpl of IMockStrk20Pool<ContractState> {
        fn register_viewing_key(ref self: ContractState, public_key: felt252) {
            self.register_viewing_key_calls.write(self.register_viewing_key_calls.read() + 1);
            self.last_public_key.write(public_key);
        }

        fn shield(
            ref self: ContractState,
            token: ContractAddress,
            amount: u256,
            user: ContractAddress,
            viewing_key: felt252,
            proof: Array<felt252>,
        ) -> felt252 {
            self.shield_calls.write(self.shield_calls.read() + 1);
            self.last_shield_token.write(token);
            self.last_shield_amount.write(amount);
            self.last_shield_user.write(user);
            self.last_shield_viewing_key.write(viewing_key);

            let mut index: u128 = 0;
            let mut proof_span = proof.span();
            loop {
                match proof_span.pop_front() {
                    Option::Some(value) => {
                        self.last_shield_proof.write(index, *value);
                        index += 1;
                    },
                    Option::None => { break; },
                }
            };
            self.last_shield_proof_len.write(index);

            (self.shield_calls.read() + 100).into()
        }

        fn unshield(
            ref self: ContractState,
            token: ContractAddress,
            amount: u256,
            recipient: ContractAddress,
            proof: Array<felt252>,
        ) {
            self.unshield_calls.write(self.unshield_calls.read() + 1);
            self.last_unshield_token.write(token);
            self.last_unshield_amount.write(amount);
            self.last_unshield_recipient.write(recipient);

            let mut index: u128 = 0;
            let mut proof_span = proof.span();
            loop {
                match proof_span.pop_front() {
                    Option::Some(value) => {
                        self.last_unshield_proof.write(index, *value);
                        index += 1;
                    },
                    Option::None => { break; },
                }
            };
            self.last_unshield_proof_len.write(index);
        }

        fn transfer(
            ref self: ContractState,
            to: ContractAddress,
            token: ContractAddress,
            amount: u256,
            proof: Array<felt252>,
        ) {
            self.transfer_calls.write(self.transfer_calls.read() + 1);
            self.last_transfer_to.write(to);
            self.last_transfer_token.write(token);
            self.last_transfer_amount.write(amount);

            let mut index: u128 = 0;
            let mut proof_span = proof.span();
            loop {
                match proof_span.pop_front() {
                    Option::Some(value) => {
                        self.last_transfer_proof.write(index, *value);
                        index += 1;
                    },
                    Option::None => { break; },
                }
            };
            self.last_transfer_proof_len.write(index);
        }

        fn get_register_viewing_key_calls(self: @ContractState) -> u128 {
            self.register_viewing_key_calls.read()
        }

        fn get_last_public_key(self: @ContractState) -> felt252 {
            self.last_public_key.read()
        }

        fn get_shield_calls(self: @ContractState) -> u128 {
            self.shield_calls.read()
        }

        fn get_last_shield_token(self: @ContractState) -> ContractAddress {
            self.last_shield_token.read()
        }

        fn get_last_shield_amount(self: @ContractState) -> u256 {
            self.last_shield_amount.read()
        }

        fn get_last_shield_user(self: @ContractState) -> ContractAddress {
            self.last_shield_user.read()
        }

        fn get_last_shield_viewing_key(self: @ContractState) -> felt252 {
            self.last_shield_viewing_key.read()
        }

        fn get_shield_proof_len(self: @ContractState) -> u128 {
            self.last_shield_proof_len.read()
        }

        fn get_shield_proof_at(self: @ContractState, index: u128) -> felt252 {
            self.last_shield_proof.read(index)
        }

        fn get_unshield_calls(self: @ContractState) -> u128 {
            self.unshield_calls.read()
        }

        fn get_last_unshield_token(self: @ContractState) -> ContractAddress {
            self.last_unshield_token.read()
        }

        fn get_last_unshield_amount(self: @ContractState) -> u256 {
            self.last_unshield_amount.read()
        }

        fn get_last_unshield_recipient(self: @ContractState) -> ContractAddress {
            self.last_unshield_recipient.read()
        }

        fn get_unshield_proof_len(self: @ContractState) -> u128 {
            self.last_unshield_proof_len.read()
        }

        fn get_unshield_proof_at(self: @ContractState, index: u128) -> felt252 {
            self.last_unshield_proof.read(index)
        }

        fn get_transfer_calls(self: @ContractState) -> u128 {
            self.transfer_calls.read()
        }

        fn get_last_transfer_to(self: @ContractState) -> ContractAddress {
            self.last_transfer_to.read()
        }

        fn get_last_transfer_token(self: @ContractState) -> ContractAddress {
            self.last_transfer_token.read()
        }

        fn get_last_transfer_amount(self: @ContractState) -> u256 {
            self.last_transfer_amount.read()
        }

        fn get_transfer_proof_len(self: @ContractState) -> u128 {
            self.last_transfer_proof_len.read()
        }

        fn get_transfer_proof_at(self: @ContractState, index: u128) -> felt252 {
            self.last_transfer_proof.read(index)
        }
    }
}