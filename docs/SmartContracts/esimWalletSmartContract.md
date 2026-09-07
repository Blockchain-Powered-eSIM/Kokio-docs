# eSIM Wallet Smart Contract

Every eSIM is linked to a unique eSIM Wallet, providing an onchain representation of the eSIM. Users can purchase data bundles through these wallets. For instance, if a user has three eSIMs, three corresponding eSIM Wallets will be deployed, each linked to a unique eSIM. The eSIM Wallets can pull ETH from the Device Wallet, so each one does not need topping up on its own. Users retain full control over their eSIM Wallets and can revoke or update permissions for each one.

To keep the two in step, a backend server generates unique identifiers for the device and the eSIMs. These identifiers are stored in the respective wallets, so the server knows which eSIM to provision and which one a data bundle belongs to.
