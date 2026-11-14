

import { useEffect, useRef, useState } from "react";

import { defineChain } from "thirdweb";

import {

  AutoConnect,

  useActiveAccount,

  useActiveWallet,

  useActiveWalletChain,

  useConnectModal,

  useDisconnect,

  useIsAutoConnecting,

  useSetActiveWallet,

  useSwitchActiveWalletChain,

  useWalletDetailsModal,

} from "thirdweb/react";

import { createWallet } from "thirdweb/wallets";

import { thirdwebClient } from "./thirdwebClient.js";

const configuredOrigin = import.meta.env.VITE_PARENT_ORIGIN;

if (!configuredOrigin) {

  throw new Error("VITE_PARENT_ORIGIN is required.");

}

const parentOrigin = new URL(configuredOrigin).origin;

const wallets = [

  createWallet("io.metamask"),

  createWallet("com.trustwallet.app"),

  createWallet("com.binance.wallet"),

  createWallet("com.coinbase.wallet"),

  createWallet("me.rainbow"),

];

const chains = {

  ethereum: 1,

  eth: 1,

  erc20: 1,

  arbitrum: 42161,

  arb: 42161,

  polygon: 137,

  matic: 137,

  bsc: 56,

  bep20: 56,

  base: 8453,

  optimism: 10,

};

const isAddress = (value) =>

  /^0x[a-fA-F0-9]{40}$/.test(String(value || "").trim());

const normalized = (value) =>

  String(value || "").trim().toLowerCase();

const keyOf = (gateway) =>

  gateway

    ? `${gateway.id}:${gateway.method}:${gateway.direction}`

    : "";

const isCancelled = (error) =>

  /cancel|close|dismiss|reject|user denied/i.test(

    String(error?.message || error)

  );

// Send events only to the configured Taran origin.
function post(type, payload = {}) {

  if (window.parent !== window) {

    window.parent.postMessage(

      {

        source: "taran-thirdweb-react",

        type,

        payload,

      },

      parentOrigin

    );

  }

}

export default function App() {

  const account = useActiveAccount();

  const activeWallet = useActiveWallet();

  const activeChain = useActiveWalletChain();

  const restoring = useIsAutoConnecting();

  const { connect } = useConnectModal();

  const { disconnect } = useDisconnect();

  const setActiveWallet = useSetActiveWallet();

  const switchChain = useSwitchActiveWalletChain();

  const walletDetails = useWalletDetailsModal();

  const [gateway, setGateway] = useState(null);

  const [error, setError] = useState("");

  const [manageRequest, setManageRequest] = useState(null);

  const gatewayRef = useRef(null);

  const walletRef = useRef(null);

  const statusRef = useRef(null);

  const actionsRef = useRef({});

  const connectIdRef = useRef(0);

  const manageIdRef = useRef(0);

  const openedManageRef = useRef(0);

  const previousAddressRef = useRef("");

  const address = String(account?.address || "").trim();

  const chainId =

    activeChain?.id ??

    activeWallet?.getChain()?.id ??

    null;

  const requiredChainId = gateway

    ? chains[gateway.method]

    : null;

  walletRef.current = {

    wallet: activeWallet,

    address,

    chainId,

  };

  function fail(message) {

    setError(message);

    post("THIRDWEB_WALLET_ERROR", {

      message,

    });

  }

// Connect a wallet, then validate it before activation.
  async function connectWallet(payload) {

    const selected = gatewayRef.current;

    const targetChain = selected && chains[selected.method];

    const expected = normalized(payload?.expectedAddress);

    if (

      !selected ||

      !targetChain ||

      (expected && !isAddress(expected))

    ) {

      fail("Invalid gateway or saved wallet address.");

      return;

    }

    const requestId = ++connectIdRef.current;

    setError("");

    try {

// Do not activate a different wallet by accident.
      const candidate = await connect({

        client: thirdwebClient,

        wallets,

        chain: defineChain(targetChain),

        showAllWallets: true,

        setActive: false,

        theme: "light",

      });

      if (

        requestId !== connectIdRef.current ||

        keyOf(gatewayRef.current) !== keyOf(selected)

      ) {

        return;

      }

      const chosenAddress = String(

        candidate?.getAccount()?.address || ""

      ).trim();

      if (!isAddress(chosenAddress)) {

        fail("Choose a valid EVM wallet.");

        return;

      }

// Existing Taran account must match.
      if (

        expected &&

        normalized(chosenAddress) !== expected

      ) {

        fail(

          "The selected wallet does not match the saved Taran address."

        );

        return;

      }

      await setActiveWallet(candidate);

      if (requestId !== connectIdRef.current) {

        return;

      }

// Vue receives the address from the actual wallet.
      post("THIRDWEB_WALLET_SELECTED", {

        gatewayId: selected.id,

        method: selected.method,

        direction: selected.direction,

        address: chosenAddress,

        chainId: candidate.getChain()?.id ?? null,

        walletId: candidate.id,

      });

    } catch (cause) {

      if (

        requestId === connectIdRef.current &&

        !isCancelled(cause)

      ) {

        fail(cause?.message || "Unable to connect wallet.");

      }

    }

  }

// Open wallet management on the selected gateway network.
  async function manageWallet(payload) {

    const selected = gatewayRef.current;

    const current = walletRef.current;

    const expected = normalized(payload?.expectedAddress);

    const targetChain = selected && chains[selected.method];

    if (

      !targetChain ||

      !current?.wallet ||

      !isAddress(expected) ||

      normalized(current.address) !== expected

    ) {

      fail("Connect the saved Taran wallet first.");

      return;

    }

    const id = ++manageIdRef.current;

    setError("");

    try {

      if (Number(current.chainId) !== targetChain) {

        await switchChain(defineChain(targetChain));

      }

      if (

        id !== manageIdRef.current ||

        keyOf(gatewayRef.current) !== keyOf(selected)

      ) {

        return;

      }

      setManageRequest({

        id,

        selected,

        expected,

        targetChain,

      });

    } catch (cause) {

      fail(cause?.message || "Unable to switch network.");

    }

  }

// Disconnect the live wallet, not the saved Taran record.
  async function disconnectWallet(payload) {

    const current = walletRef.current;

    const expected = normalized(payload?.expectedAddress);

    if (

      expected &&

      normalized(current?.address) !== expected

    ) {

      fail("The active wallet does not match the saved wallet.");

      return;

    }

    try {

      if (current?.wallet) {

        await Promise.resolve(disconnect(current.wallet));

      }

    } catch (cause) {

      fail(cause?.message || "Unable to disconnect wallet.");

      return;

    }

    const selected = gatewayRef.current;

    if (selected) {

      post("THIRDWEB_WALLET_DISCONNECTED", {

        gatewayId: selected.id,

        method: selected.method,

        direction: selected.direction,

        address: current?.address || "",

      });

    }

  }

  actionsRef.current = {

    connectWallet,

    manageWallet,

    disconnectWallet,

  };

// Keep Vue informed about the live wallet state.
  useEffect(() => {

    if (!gateway) return;

    const connected = Boolean(

      activeWallet && isAddress(address)

    );

    const payload = {

      connected,

      usable: connected,

      restoring: Boolean(restoring),

      address: connected ? address : "",

      walletId: activeWallet?.id || "",

      chainId,

      requiredChainId,

      gatewayId: gateway.id,

      method: gateway.method,

      direction: gateway.direction,

    };

    statusRef.current = payload;

    post("THIRDWEB_CONNECTION_STATUS", payload);

  }, [

    gateway,

    activeWallet,

    address,

    chainId,

    requiredChainId,

    restoring,

  ]);

// Handle disconnects originating outside Taran.
  useEffect(() => {

    const previous = previousAddressRef.current;

    if (previous && !address && !restoring && gateway) {

      post("THIRDWEB_WALLET_DISCONNECTED", {

        gatewayId: gateway.id,

        method: gateway.method,

        direction: gateway.direction,

        address: previous,

      });

    }

    previousAddressRef.current = address;

  }, [address, restoring, gateway]);

// Wait for the required network before opening wallet details.
  useEffect(() => {

    if (!manageRequest) return;

    const {

      id,

      selected,

      expected,

      targetChain,

    } = manageRequest;

    if (openedManageRef.current === id) return;

    if (

      keyOf(gatewayRef.current) !== keyOf(selected) ||

      normalized(address) !== expected ||

      !activeWallet

    ) {

      setManageRequest(null);

      return;

    }

    if (Number(chainId) !== targetChain) return;

    openedManageRef.current = id;

    setManageRequest(null);

    try {

      walletDetails.open({

        client: thirdwebClient,

        theme: "light",

        chains: [defineChain(targetChain)],

        hideDisconnect: false,

        onDisconnect: (info) => {

          post("THIRDWEB_WALLET_DISCONNECTED", {

            gatewayId: selected.id,

            method: selected.method,

            direction: selected.direction,

            address: info?.account?.address || expected,

          });

        },

        onClose: () => {

          post("THIRDWEB_MANAGE_CLOSED", {

            gatewayId: selected.id,

            method: selected.method,

            direction: selected.direction,

          });

        },

      });

    } catch (cause) {

      fail(cause?.message || "Unable to open Wallet Management.");

    }

  }, [

    manageRequest,

    address,

    chainId,

    activeWallet,

    walletDetails,

  ]);

// Receive commands from the Vue parent.
  useEffect(() => {

    function onMessage(event) {

      if (

        event.origin !== parentOrigin ||

        event.source !== window.parent ||

        event.data?.source !== "taran-vue"

      ) {

        return;

      }

      const { type, payload } = event.data;

      if (type === "TARAN_GATEWAY") {

        const id = Number(payload?.gatewayId);

        const method = normalized(payload?.method);

        const direction = payload?.direction;

        if (

          !Number.isInteger(id) ||

          id <= 0 ||

          !chains[method] ||

          !["from", "to"].includes(direction)

        ) {

          fail("Unsupported EVM gateway.");

          return;

        }

        const selected = {

          id,

          method,

          direction,

          name: String(payload?.name || ""),

        };

        if (

          keyOf(gatewayRef.current) !== keyOf(selected)

        ) {

          ++connectIdRef.current;

          ++manageIdRef.current;

          setManageRequest(null);

        }

        gatewayRef.current = selected;

        setGateway((current) =>

          keyOf(current) === keyOf(selected)

            ? current

            : selected

        );

        post("THIRDWEB_GATEWAY_RECEIVED", {

          gatewayId: id,

          method,

          direction,

        });

        return;

      }

      const selected = gatewayRef.current;

      if (

        !selected ||

        Number(payload?.gatewayId) !== selected.id ||

        normalized(payload?.method) !== selected.method ||

        payload?.direction !== selected.direction

      ) {

        return;

      }

      switch (type) {

        case "TARAN_STATUS_REQUEST":

          if (

            statusRef.current &&

            keyOf(statusRef.current) === keyOf(selected)

          ) {

            post(

              "THIRDWEB_CONNECTION_STATUS",

              statusRef.current

            );

          }

          break;

        case "TARAN_CONNECT_INTENT":

          void actionsRef.current.connectWallet(payload);

          break;

        case "TARAN_CANCEL_CONNECT":

          ++connectIdRef.current;

          break;

        case "TARAN_MANAGE_WALLET":

          void actionsRef.current.manageWallet(payload);

          break;

        case "TARAN_CANCEL_MANAGE":

          ++manageIdRef.current;

          setManageRequest(null);

          break;

        case "TARAN_DISCONNECT":

          actionsRef.current.disconnectWallet(payload);

          break;

        default:

          break;

      }

    }

    window.addEventListener("message", onMessage);

    post("THIRDWEB_READY");

    return () => {

      window.removeEventListener("message", onMessage);

    };

  }, []);

  return (

    <main className="app">

      {/* Restore previous wallet session when available. */}

      <AutoConnect

        client={thirdwebClient}

        wallets={wallets}

        timeout={15000}

      />

      <h2 className="heading">

        {gateway ? "Wallet Connection" : "Loading wallet..."}

      </h2>

      {gateway && (

        <p className="muted">

          {gateway.name || gateway.method}

        </p>

      )}

      {error && (

        <p className="error" role="alert">

          {error}

        </p>

      )}

    </main>

  );

}
