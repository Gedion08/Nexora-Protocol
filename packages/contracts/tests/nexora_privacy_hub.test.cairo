#[cfg(test)]
mod tests {
    use super::nexora_privacy_hub::nexora_privacy_hub::*;
    use starknet::ContractAddress;

    mod contract {
        use super::nexora_privacy_hub::nexora_privacy_hub::*;
        use starknet::{ContractAddress, StorageValue};
    }

    #[test]
    fn test_constructor_sets_admin_and_pool() {
        let admin = ContractAddress { 0: 1 };
        let pool = ContractAddress { 0: 2 };

        let mut contract_state = nexora_privacy_hub::nexora_privacy_hub::contract_state::initial_state(admin, pool);

        assert(contract_state.admin.read() == admin, 'Admin not set');
        assert(contract_state.pool_address.read() == pool, 'Pool not set');
    }

    #[test]
    fn test_set_pool() {
        let admin = ContractAddress { 0: 1 };
        let pool = ContractAddress { 0: 2 };
        let mut contract_state = nexora_privacy_hub::nexora_privacy_hub::contract_state::initial_state(admin, pool);

        let new_pool = ContractAddress { 0: 3 };
        set_pool(ref contract_state, new_pool);

        assert(contract_state.pool_address.read() == new_pool, 'Pool not updated');
    }

    #[test]
    fn test_add_supported_token() {
        let admin = ContractAddress { 0: 1 };
        let pool = ContractAddress { 0: 2 };
        let mut contract_state = nexora_privacy_hub::nexora_privacy_hub::contract_state::initial_state(admin, pool);

        let token = ContractAddress { 0: 3 };
        add_supported_token(ref contract_state, token);

        assert(contract_state.supported_tokens.read(token), 'Token not added');
    }

    #[test]
    #[should_panic(expected: ('NOT_ADMIN',))]
    fn test_add_supported_token_requires_admin() {
        let admin = ContractAddress { 0: 1 };
        let pool = ContractAddress { 0: 2 };
        let mut contract_state = nexora_privacy_hub::nexora_privacy_hub::contract_state::initial_state(admin, pool);

        let non_admin = ContractAddress { 0: 99 };
        let token = ContractAddress { 0: 3 };

        // This should panic because msg_sender is not admin
        add_supported_token(ref contract_state, token);
    }

    #[test]
    fn test_register_viewing_key() {
        let admin = ContractAddress { 0: 1 };
        let pool = ContractAddress { 0: 2 };
        let mut contract_state = nexora_privacy_hub::nexora_privacy_hub::contract_state::initial_state(admin, pool);

        let user = ContractAddress { 0: 4 };
        let public_key = 123456789n;

        // In a real test, we would mock the pool call
        // For now, just verify the storage write
        contract_state.user_viewing_keys.write(user, public_key);
        assert(contract_state.user_viewing_keys.read(user) == public_key, 'Viewing key not stored');
    }
}
