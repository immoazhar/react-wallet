# Taran Thirdweb React iframe + Vue 3 bridge

This starter creates a **separate React wallet application** using Thirdweb's official ConnectEmbed, and a **Vue Options API iframe bridge** for Taran Web.

## React setup

1. `cd react-wallet`
2. `cp .env.example .env`
3. Set `VITE_THIRDWEB_CLIENT_ID` to your public Thirdweb Client ID.
4. Set `VITE_PARENT_ORIGIN` to your actual Taran Vue origin (exact scheme, host, port), e.g. `http://localhost:5173`.
5. `npm install`
6. `npm run dev` (opens `http://localhost:5174`).

In the Thirdweb dashboard, allow the React app's domain/origin for your Client ID if required. Open `http://localhost:5174` directly to test the Thirdweb wallet UI in standalone demo mode (no Address Book save occurs from standalone mode).

## Vue setup

1. In existing Taran Vue app's `.env` add `VITE_THIRDWEB_IFRAME_URL=http://localhost:5174` and restart Vite.
2. Replace the existing `src/components/TaranConnectWallet.vue` with `vue-integration/TaranConnectWallet.vue` (or adapt the component import path).
3. Keep the existing `CentralModel.vue` use:

```vue
<TaranConnectWallet
  v-if="type === 'empty-account' && showConnectWallet"
  :gateway="walletGateway"
  :direction="walletDirection"
  @wallet-connected="handleWalletConnected"
/>
```

4. Keep existing `SwapDetail.vue` `@wallet-connected="saveConnectedWallet"` handler. The Vue bridge validates incoming message origin/source, gateway ID, direction, and EVM address syntax before forwarding the event.
5. React sends wallet data ONLY when the user clicks **Use This Wallet** (no automatic Address Book saving after connection).

## Event contract

- React -> Vue: `THIRDWEB_READY`
- Vue -> React: `TARAN_GATEWAY` with gatewayId, name, chain, gatewayType, direction
- React -> Vue: `THIRDWEB_WALLET_SELECTED` with address, gatewayId, chainId, direction
- React -> Vue: `THIRDWEB_WALLET_DISCONNECTED`

Both sides check the exact sender origin; Vue additionally checks the iframe `contentWindow`.

## Security and limitations

- This example is **EVM wallet connect/disconnect only**. It does not connect TRC20/TRON or Solana wallets.
- It does **not** force the wallet to the chain represented by the gateway. Wallet chain ID is reported for display. Validate network compatibility BEFORE using the address for transactions.
- `postMessage` and wallet connection DO NOT prove wallet ownership to your Laravel server. Before bypassing OTP, implement a server-issued nonce challenge, `account.signMessage` in Thirdweb, and server-side signature verification with replay protection. Never trust a `verified` flag supplied by the browser.
- Some extension-injected providers are not available inside cross-origin iframes. Test standalone React page first; WalletConnect/QR or a top-level fallback may be needed. Avoid restrictive iframe sandbox settings that block scripts/popups.
- For production use HTTPS, exact Vue/React origins, appropriate `Content-Security-Policy: frame-ancestors` on the React app, and configured Thirdweb allowed domains. Never post authentication tokens or private keys through `postMessage`.
- Browser privacy restrictions can affect third-party cookies, storage, popups and wallet-extension behavior within cross-origin iframes.
