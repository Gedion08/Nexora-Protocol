#[starknet::contract]
pub mod nexora_privacy_hub {
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use starknet::storage::*;
    use starknet::event::EventEmitter;
    use core::num::traits::Zero;

    const ERR_NOT_ADMIN: felt252 = 'NOT_ADMIN';
    const ERR_TOKEN_NOT_SUPPORTED: felt252 = 'TOKEN_NOT_SUPPORTED';
    const ERR_ZERO_AMOUNT: felt252 = 'ZERO_AMOUNT';
    const ERR_ZERO_ADDRESS: felt252 = 'ZERO_ADDRESS';
    const ERR_EMPTY_PROOF: felt252 = 'EMPTY_PROOF';

    #[starknet::interface]
    pub trait IERC20<TContractState> {
        fn transfer_from(self: @TContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256);
    }

    #[starknet::interface]
    pub trait IStrt20Pool<TContractState> {
        fn register_viewing_key(self: @TContractState, public_key: felt252);
        fn shield(
            self: @TContractState,
            token: ContractAddress,
            amount: u256,
            user: ContractAddress,
            viewing_key: felt252,
            proof: Array<felt252>,
        ) -> felt252;
        fn unshield(
            self: @TContractState,
            token: ContractAddress,
            amount: u256,
            recipient: ContractAddress,
            proof: Array<felt252>,
        );
        fn transfer(self: @TContractState, to: ContractAddress, token: ContractAddress, amount: u256, proof: Array<felt252>);
    }

    #[starknet::interface]
    pub trait INexoraPrivacyHub<TContractState> {
        fn get_admin(self: @TContractState) -> ContractAddress;
        fn get_pool(self: @TContractState) -> ContractAddress;
        fn is_supported_token(self: @TContractState, token: ContractAddress) -> bool;
        fn get_user_viewing_key(self: @TContractState, user: ContractAddress) -> felt252;
        fn add_supported_token(ref self: TContractState, token: ContractAddress);
        fn set_admin(ref self: TContractState, new_admin: ContractAddress);
        fn set_pool(ref self: TContractState, pool: ContractAddress);
        fn register_viewing_key(ref self: TContractState, public_key: felt252);
        fn shield(ref self: TContractState, token: ContractAddress, amount: u256, proof: Array<felt252>);
        fn unshield(
            ref self: TContractState,
            token: ContractAddress,
            amount: u256,
            recipient: ContractAddress,
            proof: Array<felt252>,
        );
        fn private_transfer(
            ref self: TContractState,
            to: ContractAddress,
            token: ContractAddress,
            amount: u256,
            proof: Array<felt252>,
        );
    }

    #[storage]
    struct Storage {
        pool_address: ContractAddress,
        admin: ContractAddress,
        supported_tokens: Map<ContractAddress, bool>,
        user_viewing_keys: Map<ContractAddress, felt252>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Shielded: Shielded,
        Unshielded: Unshielded,
        PrivateTransferred: PrivateTransferred,
        ViewingKeyRegistered: ViewingKeyRegistered,
        SupportedTokenAdded: SupportedTokenAdded,
        PoolSet: PoolSet,
        AdminSet: AdminSet,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Shielded {
        pub user: ContractAddress,
        pub token: ContractAddress,
        pub amount: u256,
        pub note_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Unshielded {
        pub user: ContractAddress,
        pub token: ContractAddress,
        pub amount: u256,
        pub recipient: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PrivateTransferred {
        pub from: ContractAddress,
        pub to: ContractAddress,
        pub token: ContractAddress,
        pub amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct ViewingKeyRegistered {
        pub user: ContractAddress,
        pub public_key: felt252,
    }

    #[derive(Drop, starknet::Event)]
    pub struct SupportedTokenAdded {
        pub token: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct PoolSet {
        pub pool: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    pub struct AdminSet {
        pub admin: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, admin: ContractAddress, pool: ContractAddress) {
        assert(!admin.is_zero(), ERR_ZERO_ADDRESS);
        assert(!pool.is_zero(), ERR_ZERO_ADDRESS);
        self.admin.write(admin);
        self.pool_address.write(pool);
    }

    #[abi(embed_v0)]
    impl HubImpl of INexoraPrivacyHub<ContractState> {
        fn get_admin(self: @ContractState) -> ContractAddress {
            self.admin.read()
        }

        fn get_pool(self: @ContractState) -> ContractAddress {
            self.pool_address.read()
        }

        fn is_supported_token(self: @ContractState, token: ContractAddress) -> bool {
            self.supported_tokens.read(token)
        }

        fn get_user_viewing_key(self: @ContractState, user: ContractAddress) -> felt252 {
            self.user_viewing_keys.read(user)
        }

        fn add_supported_token(ref self: ContractState, token: ContractAddress) {
            assert(self.admin.read() == get_caller_address(), ERR_NOT_ADMIN);
            assert(!token.is_zero(), ERR_ZERO_ADDRESS);
            self.supported_tokens.write(token, true);
            self.emit(Event::SupportedTokenAdded(SupportedTokenAdded { token }));
        }

        fn set_admin(ref self: ContractState, new_admin: ContractAddress) {
            assert(self.admin.read() == get_caller_address(), ERR_NOT_ADMIN);
            assert(!new_admin.is_zero(), ERR_ZERO_ADDRESS);
            self.admin.write(new_admin);
            self.emit(Event::AdminSet(AdminSet { admin: new_admin }));
        }

        fn set_pool(ref self: ContractState, pool: ContractAddress) {
            assert(self.admin.read() == get_caller_address(), ERR_NOT_ADMIN);
            assert(!pool.is_zero(), ERR_ZERO_ADDRESS);
            self.pool_address.write(pool);
            self.emit(Event::PoolSet(PoolSet { pool }));
        }

        fn register_viewing_key(ref self: ContractState, public_key: felt252) {
            let user = get_caller_address();
            let pool_address = self.pool_address.read();

            let pool = IStrt20PoolDispatcher { contract_address: pool_address };
            pool.register_viewing_key(public_key);

            self.user_viewing_keys.write(user, public_key);
            self.emit(Event::ViewingKeyRegistered(ViewingKeyRegistered { user, public_key }));
        }

        fn shield(ref self: ContractState, token: ContractAddress, amount: u256, proof: Array<felt252>) {
            let user = get_caller_address();
            assert(amount > 0, ERR_ZERO_AMOUNT);
            assert(!token.is_zero(), ERR_ZERO_ADDRESS);
            assert(self.supported_tokens.read(token), ERR_TOKEN_NOT_SUPPORTED);

            let hub_address = get_contract_address();
            let erc20 = IERC20Dispatcher { contract_address: token };
            erc20.transfer_from(user, hub_address, amount);

            let pool_address = self.pool_address.read();
            let viewing_key = self.user_viewing_keys.read(user);
            let pool = IStrt20PoolDispatcher { contract_address: pool_address };
            let note_hash = pool.shield(token, amount, user, viewing_key, proof);

            self.emit(Event::Shielded(Shielded { user, token, amount, note_hash }));
        }

        fn unshield(
            ref self: ContractState,
            token: ContractAddress,
            amount: u256,
            recipient: ContractAddress,
            proof: Array<felt252>,
        ) {
            let user = get_caller_address();
            assert(amount > 0, ERR_ZERO_AMOUNT);
            assert(!recipient.is_zero(), ERR_ZERO_ADDRESS);
            assert(!token.is_zero(), ERR_ZERO_ADDRESS);
            assert(self.supported_tokens.read(token), ERR_TOKEN_NOT_SUPPORTED);
            assert(!proof.is_empty(), ERR_EMPTY_PROOF);

            let pool_address = self.pool_address.read();
            let pool = IStrt20PoolDispatcher { contract_address: pool_address };
            pool.unshield(token, amount, recipient, proof);

            self.emit(Event::Unshielded(Unshielded { user, token, amount, recipient }));
        }

        fn private_transfer(
            ref self: ContractState,
            to: ContractAddress,
            token: ContractAddress,
            amount: u256,
            proof: Array<felt252>,
        ) {
            let user = get_caller_address();
            assert(amount > 0, ERR_ZERO_AMOUNT);
            assert(!to.is_zero(), ERR_ZERO_ADDRESS);
            assert(!token.is_zero(), ERR_ZERO_ADDRESS);
            assert(self.supported_tokens.read(token), ERR_TOKEN_NOT_SUPPORTED);
            assert(!proof.is_empty(), ERR_EMPTY_PROOF);

            let pool_address = self.pool_address.read();
            let pool = IStrt20PoolDispatcher { contract_address: pool_address };
            pool.transfer(to, token, amount, proof);

            self.emit(Event::PrivateTransferred(PrivateTransferred { from: user, to, token, amount }));
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;
        use starknet::ContractAddress;
        use starknet::storage::StoragePointerWriteAccess;
        use snforge_std::{start_cheat_caller_address_global};

        const ADMIN: felt252 = 1;
        const POOL: felt252 = 2;
        const TOKEN: felt252 = 3;
        const PUBLIC_KEY: felt252 = 123456789;

        fn felt_address(value: felt252) -> ContractAddress {
            value.try_into().unwrap()
        }

        fn admin() -> ContractAddress {
            felt_address(ADMIN)
        }

        fn pool_addr() -> ContractAddress {
            felt_address(POOL)
        }

        fn token() -> ContractAddress {
            felt_address(TOKEN)
        }

        fn setup_with_admin() -> ContractState {
            let mut state = unsafe_new_contract_state();
            state.admin.write(admin());
            state.pool_address.write(pool_addr());
            start_cheat_caller_address_global(admin());
            state
        }

        #[test]
        fn test_getters_reflect_storage() {
            let state = setup_with_admin();
            assert(HubImpl::get_admin(@state) == admin(), 'Admin getter wrong');
            assert(HubImpl::get_pool(@state) == pool_addr(), 'Pool getter wrong');
            assert(!HubImpl::is_supported_token(@state, token()), 'Token should be unsupported');
            assert(HubImpl::get_user_viewing_key(@state, admin()) == 0, 'VK should be empty');
        }

        #[test]
        fn test_add_supported_token() {
            let mut state = setup_with_admin();
            HubImpl::add_supported_token(ref state, token());
            assert(HubImpl::is_supported_token(@state, token()), 'Token not added');
        }

        #[test]
        fn test_set_pool() {
            let mut state = setup_with_admin();
            let new_pool = felt_address(5);
            HubImpl::set_pool(ref state, new_pool);
            assert(HubImpl::get_pool(@state) == new_pool, 'Pool not updated');
        }

        #[test]
        fn test_set_admin() {
            let mut state = setup_with_admin();
            let new_admin = felt_address(6);
            HubImpl::set_admin(ref state, new_admin);
            assert(HubImpl::get_admin(@state) == new_admin, 'Admin not updated');
        }

        #[test]
        fn test_viewing_key_storage() {
            let mut state = setup_with_admin();
            let user = felt_address(0);
            state.user_viewing_keys.write(user, PUBLIC_KEY);
            assert(HubImpl::get_user_viewing_key(@state, user) == PUBLIC_KEY, 'Viewing key not stored');
        }
    }
}
