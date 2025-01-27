# Smart Contract Suite User Flow

1. **Install the eSIM Wallet App**:  
   Users install the app and register their passkeys. Passkeys (P256 keys) derive their security from the device’s Secure Enclave.
2. **Device and eSIM Wallet Deployment**:  
   For new devices, the app requests the Registry to deploy a Device Wallet and an associated eSIM Wallet. These are linked upon deployment.
3. **Data Bundle Selection & Purchase**:  
   a. Users select a data bundle plan before eSIM generation.  
   b. The app initiates the purchase. If paid via crypto, both wallets are deployed immediately. For fiat transactions, users can deploy their wallets later if needed.  
   c. Upon successful purchase, the server initiates the eSIM and data bundle provisioning.  
   d. The server generates a unique eSIM identifier and updates the corresponding eSIM Wallet via the Device Wallet.

4. **eSIM Activation**:  
   The app provides a QR code for eSIM activation, which users can scan to begin using the eSIM.

5. **Primary Wallet Use**:  
   Users can also use the Device Wallet as their primary wallet and withdraw funds anytime.
