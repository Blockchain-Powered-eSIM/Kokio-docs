# Kokio Mobile App

## Userflow

![](../../resources/KokioUserFlowMobileApp.png)

1. **Install the eSIM Wallet App**:  
   Users install the app and register their passkeys. Passkeys (P256 keys) derive their security from the device’s Secure Enclave.

2. **Device and eSIM Wallet Deployment**:  
   For new devices, the app requests to deploy a Device Wallet and an associated eSIM Wallet. These are linked upon deployment.

3. **Data Bundle Selection & Purchase**:  
   a. Users select a data bundle plan before eSIM generation.  
   b. The app initiates the purchase.
    - If paid via crypto, the wallet is deployed and funded immediately.
    - For fiat transactions, users can deploy their wallets later when needed.  
   c. Upon successful purchase, the server initiates the eSIM and data bundle provisioning.  
   d. A unique identifier is generated corresponding to the users' eSIM purchase.

4. **eSIM Activation**:  
   The app provides multiple installation methods:
   - a QR code for eSIM activation, which users can scan to begin using the eSIM.
   - manual installation, users manually enter the eSIM details via device settings.
   - one-click installation, users clicks on in-app `install` button.

5. **Primary Wallet Use**:  
   Users can also use the Device Wallet as their primary wallet across DeFi protocols and transfer funds between wallets anytime.
