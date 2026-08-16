#[starknet::contract]
pub mod nexora_privacy_hub {
    use starknet::ContractAddress;
    use starknet::storage::*;
    use starknet::event::EventEmitter;
    use core::num::traits::Zero;

    const ERR_NOT_ADMIN: felt252 = 'NOT_ADMIN';
    const ERR_TOKEN_NOT_SUPPORTED: felt252 = 'TOKEN_NOT_SUPPORTED';
    const ERR_ZERO_AMOUNT: felt252 = 'ZERO_AMOUNT';
    const ERR_ZERO_ADDRESS: felt252 = 'ZERO_ADDRESS';
    const ERR_ALREADY_REGISTERED: felt252 = 'ALREADY_REGISTERED';

    #[starknet::interface]
    trait IERC20 {
        fn transfer_from(ref self: ContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256);
    }

    #[starknet::interface]
    trait IStrt20Pool {
        fn register_viewing_key(self: @ContractState, public_key: felt252);
        fn shield(self: @ContractState, token: ContractAddress, amount: u256, user: ContractAddress, viewing_key: felt252, proof: Array<felt252>) -> felt252;
        fn unshield(ref self: ContractState, token: ContractAddress, amount: u256, recipient: ContractAddress, proof: Array<felt252>);
        fn transfer(ref self: ContractState, to: ContractAddress, token: ContractAddress, amount: u256, proof: Array<felt252>);
    }

    #[storage]
    struct Storage {
        pool_address: StorageValue<ContractAddress>,
        admin: StorageValue<ContractAddress>,
        supported_tokens: LegacyMap<ContractAddress, bool>,
        user_viewing_keys: LegacyMap<ContractAddress, felt252>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Shielded: Shielded,
        Unshielded: Unshielded,
        PrivateTransferred: PrivateTransferred,
        ViewingKeyRegistered: ViewingKeyRegistered,
        SupportedTokenAdded: SupportedTokenAdded,
        PoolSet: PoolSet,
        AdminSet: AdminSet,
    }

    #[derive(Drop, starknet::Event)]
    struct Shielded {
        user: ContractAddress,
        token: ContractAddress,
        amount: u256,
        note_hash: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct Unshielded {
        user: ContractAddress,
        token: ContractAddress,
        amount: u256,
        recipient: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct PrivateTransferred {
        from: ContractAddress,
        to: ContractAddress,
        token: ContractAddress,
        amount: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct ViewingKeyRegistered {
        user: ContractAddress,
        public_key: felt252,
    }

    #[derive(Drop, starknet::Event)]
    struct SupportedTokenAdded {
        token: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct PoolSet {
        pool: ContractAddress,
    }

    #[derive(Drop, starknet::Event)]
    struct AdminSet {
        admin: ContractAddress,
    }

    #[constructor]
    fn constructor(ref self: ContractState, admin: ContractAddress, pool: ContractAddress) {
        assert(!admin.is_zero(), ERR_ZERO_ADDRESS);
        assert(!pool.is_zero(), ERR_ZERO_ADDRESS);
        self.admin.write(admin);
        self.pool_address.write(pool);
    }

    #[external(v0)]
    fn add_supported_token(ref self: ContractState, token: ContractAddress) {
        assert(self.admin.read() == msg_sender(), ERR_NOT_ADMIN);
        assert(!token.is_zero(), ERR_ZERO_ADDRESS);
        self.supported_tokens.write(token, true);
        self.emit(Event::SupportedTokenAdded(SupportedTokenAdded { token }));
    }

    #[external(v0)]
    fn set_admin(ref self: ContractState, new_admin: ContractAddress) {
        assert(self.admin.read() == msg_sender(), ERR_NOT_ADMIN);
        assert(!new_admin.is_zero(), ERR_ZERO_ADDRESS);
        self.admin.write(new_admin);
        self.emit(Event::AdminSet(AdminSet { admin: new_admin }));
    }

    #[external(v0)]
    fn set_pool(ref self: ContractState, pool: ContractAddress) {
        assert(self.admin.read() == msg_sender(), ERR_NOT_ADMIN);
        assert(!pool.is_zero(), ERR_ZERO_ADDRESS);
        self.pool_address.write(pool);
        self.emit(Event::PoolSet(PoolSet { pool }));
    }

    #[external(v0)]
    fn register_viewing_key(ref self: ContractState, public_key: felt252) {
        let user = msg_sender();
        let pool_address = self.pool_address.read();

        let pool = IStrt20PoolDispatcher { contract_address: pool_address };
        pool.register_viewing_key(public_key);

        self.user_viewing_keys.write(user, public_key);
        self.emit(Event::ViewingKeyRegistered(ViewingKeyRegistered { user, public_key }));
    }

    #[external(v0)]
    fn shield(ref self: ContractState, token: ContractAddress, amount: u256) {
        let user = msg_sender();
        assert(amount > 0, ERR_ZERO_AMOUNT);
        assert(!token.is_zero(), ERR_ZERO_ADDRESS);
        assert(self.supported_tokens.read(token), ERR_TOKEN_NOT_SUPPORTED);

        let hub_address = get_contract_address();
        let erc20 = IERC20Dispatcher { contract_address: token };
        erc20.transfer_from(user, hub_address, amount);

        let pool_address = self.pool_address.read();
        let viewing_key = self.user_viewing_keys.read(user);
        let pool = IStrt20PoolDispatcher { contract_address: pool_address };
        let note_hash = pool.shield(token, amount, user, viewing_key, array![]);

        self.emit(Event::Shielded(Shielded { user, token, amount, note_hash }));
    }

    #[external(v0)]
    fn unshield(
        ref self: ContractState,
        token: ContractAddress,
        amount: u256,
        recipient: ContractAddress,
        proof: Array<felt252>,
    ) {
        let user = msg_sender();
        assert(amount > 0, ERR_ZERO_AMOUNT);
        assert(!recipient.is_zero(), ERR_ZERO_ADDRESS);
        assert(!token.is_zero(), ERR_ZERO_ADDRESS);
        assert(self.supported_tokens.read(token), ERR_TOKEN_NOT_SUPPORTED);

        let pool_address = self.pool_address.read();
        let pool = IStrt20PoolDispatcher { contract_address: pool_address };
        pool.unshield(token, amount, recipient, proof);

        self.emit(Event::Unshielded(Unshielded { user, token, amount, recipient }));
    }

    #[external(v0)]
    fn private_transfer(
        ref self: ContractState,
        to: ContractAddress,
        token: ContractAddress,
        amount: u256,
        proof: Array<felt252>,
    ) {
        let user = msg_sender();
        assert(amount > 0, ERR_ZERO_AMOUNT);
        assert(!to.is_zero(), ERR_ZERO_ADDRESS);
        assert(!token.is_zero(), ERR_ZERO_ADDRESS);
        assert(self.supported_tokens.read(token), ERR_TOKEN_NOT_SUPPORTED);

        let pool_address = self.pool_address.read();
        let pool = IStrt20PoolDispatcher { contract_address: pool_address };
        pool.transfer(to, token, amount, proof);

        self.emit(Event::PrivateTransferred(PrivateTransferred { from: user, to, token, amount }));
    }
}
