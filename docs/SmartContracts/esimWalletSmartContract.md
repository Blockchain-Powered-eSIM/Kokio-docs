# eSIM Wallet Smart Contract

Every eSIM is linked to a unique eSIM Wallet, providing an on-chain representation of the eSIM. Users can purchase data bundles through these wallets. For instance, if a user has three eSIMs, three corresponding eSIM Wallets will be deployed, each linked to a unique eSIM. The eSIM Wallets can pull ETH from the Device Wallet, offering a streamlined experience without requiring individual top-ups. Users retain full control over their eSIM Wallets and can revoke or update permissions for each one.

For seamless synchronization, a backend server securely generates unique identifiers for the device and eSIMs. These identifiers are stored in the respective wallets, ensuring secure eSIM generation and accurate data bundle application.

<!-- Each eSIM is associated with a unique eSIM wallet smart contract. This eSIM wallet is an on-chain representation of the eSIM and allows user to buy the data bundles.

For example, if a user has 3 eSIMs in his mobile device, then there will be 3 eSIM wallets associated with a device wallet. Each of these eSIM wallets are mapped to their respective eSIM. Moreover all of these eSIMs have the ability to pull ETH from their respective device wallet, allowing user for a smooth experience and not worrying about topping-up each of the eSIM wallet. The user also owns all these eSIM wallets and hence can update/revoke any eSIM wallet's ability to pull ETH from the device wallet.

For the eSIM wallet and device wallet to perfectly map to a user's mobile device and eSIMs, a server in the backend securely generates unique identifiers. The device wallet and the eSIM wallets deployed by the master keystore (through the eSIM wallet app) store these unique identifiers, thus allowing the server to proceed with generating eSIM (in case of buying a new eSIM) or applying data bundle for the correct eSIM. -->
