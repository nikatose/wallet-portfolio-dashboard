const NETWORKS = {

  ethereum: {
    name: "Ethereum",
    chainId: 1,
    symbol: "ETH",
    explorer: "https://etherscan.io/address/",
    api: "https://eth.blockscout.com/api/v2",
    rpc: "https://eth.llamarpc.com"
  },

  base: {
    name: "Base",
    chainId: 8453,
    symbol: "ETH",
    explorer: "https://basescan.org/address/",
    api: "https://base.blockscout.com/api/v2",
    rpc: "https://base.llamarpc.com"
  },

  arbitrum: {
    name: "Arbitrum One",
    chainId: 42161,
    symbol: "ETH",
    explorer: "https://arbiscan.io/address/",
    api: "https://arbitrum.blockscout.com/api/v2",
    rpc: "https://arbitrum.llamarpc.com"
  },

  optimism: {
    name: "Optimism",
    chainId: 10,
    symbol: "ETH",
    explorer: "https://optimistic.etherscan.io/address/",
    api: "https://optimism.blockscout.com/api/v2",
    rpc: "https://optimism.llamarpc.com"
  },

  polygon: {
    name: "Polygon",
    chainId: 137,
    symbol: "POL",
    explorer: "https://polygonscan.com/address/",
    api: "https://polygon.blockscout.com/api/v2",
    rpc: "https://polygon.llamarpc.com"
  }

};


const addressInput = document.getElementById("addressInput");
const loadButton = document.getElementById("loadButton");
const networkSelect = document.getElementById("networkSelect");

const dashboard = document.getElementById("dashboard");
const welcome = document.getElementById("welcome");

const loading = document.getElementById("loading");
const errorBox = document.getElementById("errorBox");
const inputError = document.getElementById("inputError");

const shortAddress = document.getElementById("shortAddress");
const copyButton = document.getElementById("copyButton");

const nativeBalance = document.getElementById("nativeBalance");
const nativeSymbol = document.getElementById("nativeSymbol");

const tokenCount = document.getElementById("tokenCount");
const networkName = document.getElementById("networkName");
const chainId = document.getElementById("chainId");

const assetTable = document.getElementById("assetTable");
const emptyState = document.getElementById("emptyState");

const allocation = document.getElementById("allocation");
const refreshButton = document.getElementById("refreshButton");


let currentAddress = "";


function isValidEvmAddress(address) {

  return /^0x[a-fA-F0-9]{40}$/.test(address);

}


function shortenAddress(address) {

  if (!address) {
    return "—";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;

}


function formatNumber(value, maximumFractionDigits = 6) {

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits
  }).format(number);

}


function formatUsd(value) {

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  if (number === 0) {
    return "$0";
  }

  if (number < 0.01) {
    return "<$0.01";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(number);

}


function showError(message) {

  errorBox.textContent = message;

  errorBox.classList.remove("hidden");

}


function clearError() {

  errorBox.textContent = "";

  errorBox.classList.add("hidden");

}


function setLoading(isLoading) {

  loading.classList.toggle("hidden", !isLoading);

  loadButton.disabled = isLoading;

  refreshButton.disabled = isLoading;

}


async function fetchJson(url) {

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `API request failed: ${response.status}`
    );
  }

  return response.json();

}


async function getNativeBalance(address, network) {

  const payload = {
    jsonrpc: "2.0",
    id: 1,
    method: "eth_getBalance",
    params: [address, "latest"]
  };

  const response = await fetch(network.rpc, {
    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error("RPC request failed");
  }

  const data = await response.json();

  if (!data.result) {
    throw new Error("Native balance unavailable");
  }

  const wei = BigInt(data.result);

  const divisor = 1000000000000000000n;

  const whole = wei / divisor;

  const fraction = wei % divisor;

  const fractionString =
    fraction.toString().padStart(18, "0");

  const combined =
    `${whole}.${fractionString}`;

  return Number(combined);
}


function extractTokenBalance(token) {

  if (!token) {
    return 0;
  }

  const raw = token.value;

  const decimals =
    token.token?.decimals ??
    token.decimals ??
    18;

  if (raw === undefined || raw === null) {
    return 0;
  }

  try {

    const rawBigInt = BigInt(raw);

    const divisor =
      10n ** BigInt(decimals);

    const whole =
      rawBigInt / divisor;

    const fraction =
      rawBigInt % divisor;

    const fractionString =
      fraction.toString().padStart(
        Number(decimals),
        "0"
      );

    const result =
      `${whole}.${fractionString}`;

    return Number(result);

  } catch {

    return 0;

  }

}


function normalizeToken(token) {

  const tokenInfo = token.token || token;

  const symbol =
    tokenInfo.symbol ||
    "UNKNOWN";

  const name =
    tokenInfo.name ||
    symbol;

  const decimals =
    Number(tokenInfo.decimals ?? 18);

  const address =
    tokenInfo.address ||
    token.address ||
    "";

  const icon =
    tokenInfo.icon_url ||
    tokenInfo.icon ||
    "";

  const value =
    extractTokenBalance(token);

  let usdPrice = 0;

  if (tokenInfo.exchange_rate) {
    usdPrice = Number(tokenInfo.exchange_rate);
  }

  if (
    token.exchange_rate !== undefined &&
    token.exchange_rate !== null
  ) {
    usdPrice = Number(token.exchange_rate);
  }

  return {
    address,
    symbol,
    name,
    decimals,
    icon,
    balance: value,
    price: Number.isFinite(usdPrice)
      ? usdPrice
      : 0
  };

}


async function getTokens(address, network) {

  const url =
    `${network.api}/addresses/${address}/token-balances`;

  const data = await fetchJson(url);

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map(normalizeToken)
    .filter(token => token.balance > 0)
    .sort((a, b) => {

      const aValue =
        a.balance * a.price;

      const bValue =
        b.balance * b.price;

      return bValue - aValue;

    });

}


function tokenIcon(token) {

  if (token.icon) {

    return `
      <img
        class="token-icon"
        src="${token.icon}"
        alt=""
        onerror="this.style.display='none'"
      >
    `;

  }

  return `
    <div class="token-icon">
      ${escapeHtml(
        token.symbol.slice(0, 3)
      )}
    </div>
  `;

}


function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


function renderAssets(tokens, native) {

  assetTable.innerHTML = "";

  const nativeUsd =
    native.price
      ? native.balance * native.price
      : 0;

  const assets = [

    {
      symbol: native.symbol,
      name: native.name,
      balance: native.balance,
      price: native.price,
      usd: nativeUsd,
      address: null,
      icon: null,
      native: true
    },

    ...tokens.map(token => ({
      ...token,
      usd: token.balance * token.price,
      native: false
    }))

  ];


  const totalUsd =
    assets.reduce(
      (sum, asset) =>
        sum + (asset.usd || 0),
      0
    );


  assets.sort(
    (a, b) =>
      (b.usd || 0) -
      (a.usd || 0)
  );


  if (assets.length === 0) {

    emptyState.classList.remove("hidden");

    return;

  }


  emptyState.classList.add("hidden");


  for (const asset of assets) {

    const share =
      totalUsd > 0
        ? (asset.usd / totalUsd) * 100
        : 0;


    const row =
      document.createElement("tr");


    let explorer = "#";

    if (!asset.native && asset.address) {

      explorer =
        `${NETWORKS[
          networkSelect.value
        ].explorer}${asset.address}`;

    }


    row.innerHTML = `

      <td>

        <div class="asset">

          ${
            asset.native
              ? `
                <div class="token-icon">
                  ${asset.symbol.slice(0, 3)}
                </div>
              `
              : tokenIcon(asset)
          }

          <div>

            <div class="asset-name">
              ${escapeHtml(asset.symbol)}
            </div>

            <div class="asset-address">
              ${
                asset.native
                  ? escapeHtml(asset.name)
                  : shortenAddress(asset.address)
              }
            </div>

          </div>

        </div>

      </td>


      <td class="balance">
        ${formatNumber(asset.balance)}
        ${escapeHtml(asset.symbol)}
      </td>


      <td class="usd">
        ${
          asset.price > 0
            ? formatUsd(asset.usd)
            : "—"
        }
      </td>


      <td>

        <div class="share-wrap">

          <div class="share-bar">

            <div
              class="share-fill"
              style="width:${Math.min(
                share,
                100
              )}%"
            ></div>

          </div>

          <span>
            ${share.toFixed(1)}%
          </span>

        </div>

      </td>


      <td>

        ${
          asset.native
            ? ""
            : `
              <a
                class="explorer"
                href="${explorer}"
                target="_blank"
                rel="noopener"
              >
                ↗
              </a>
            `
        }

      </td>

    `;


    assetTable.appendChild(row);

  }


  renderAllocation(assets, totalUsd);

}


function renderAllocation(assets, totalUsd) {

  allocation.innerHTML = "";

  if (!totalUsd) {

    allocation.innerHTML = `
      <div class="empty-state">
        USD price data is unavailable for these assets.
      </div>
    `;

    return;

  }


  for (const asset of assets) {

    if (!asset.usd || asset.usd <= 0) {
      continue;
    }

    const share =
      (asset.usd / totalUsd) * 100;


    const item =
      document.createElement("div");

    item.className =
      "allocation-item";


    item.innerHTML = `

      <div class="allocation-name">
        ${escapeHtml(asset.symbol)}
      </div>

      <div class="allocation-bar">

        <div
          class="allocation-fill"
          style="width:${Math.min(
            share,
            100
          )}%"
        ></div>

      </div>

      <div class="allocation-percent">
        ${share.toFixed(1)}%
      </div>

    `;


    allocation.appendChild(item);

  }

}


async function loadPortfolio() {

  clearError();

  inputError.textContent = "";

  const address =
    addressInput.value.trim();


  if (!isValidEvmAddress(address)) {

    inputError.textContent =
      "Enter a valid EVM address.";

    return;

  }


  currentAddress = address;


  const network =
    NETWORKS[networkSelect.value];


  dashboard.classList.remove("hidden");

  welcome.classList.add("hidden");


  shortAddress.textContent =
    shortenAddress(address);


  networkName.textContent =
    network.name;

  chainId.textContent =
    `Chain ID ${network.chainId}`;

  nativeSymbol.textContent =
    network.symbol;


  setLoading(true);


  try {

    const [
      balance,
      tokens
    ] = await Promise.all([

      getNativeBalance(
        address,
        network
      ),

      getTokens(
        address,
        network
      )

    ]);


    nativeBalance.textContent =
      `${formatNumber(balance)} ${network.symbol}`;


    tokenCount.textContent =
      tokens.length;


    const nativePrice =
      await getNativePrice(
        network
      );


    renderAssets(
      tokens,
      {
        name: network.name,
        symbol: network.symbol,
        balance,
        price: nativePrice
      }
    );


  } catch (error) {

    console.error(error);

    showError(
      "Could not load this wallet. The selected network API may be temporarily unavailable."
    );

    nativeBalance.textContent = "—";

    tokenCount.textContent = "—";

    assetTable.innerHTML = "";

    allocation.innerHTML = "";

  } finally {

    setLoading(false);

  }

}


async function getNativePrice(network) {

  /*
   * Blockscout may provide native token
   * exchange-rate information through
   * the address endpoint.
   *
   * We attempt to read it here.
   */

  try {

    const url =
      `${network.api}/addresses/${currentAddress}`;

    const data =
      await fetchJson(url);


    if (
      data &&
      data.coin_balance_usd !== undefined
    ) {

      const balance =
        Number(data.coin_balance) /
        1e18;

      const usd =
        Number(data.coin_balance_usd);


      if (
        balance > 0 &&
        Number.isFinite(usd)
      ) {

        return usd / balance;

      }

    }


    if (
      data &&
      data.exchange_rate
    ) {

      return Number(
        data.exchange_rate
      );

    }


  } catch (error) {

    console.warn(
      "Native price unavailable",
      error
    );

  }


  return 0;

}


async function copyAddress() {

  if (!currentAddress) {
    return;
  }

  try {

    await navigator.clipboard.writeText(
      currentAddress
    );

    copyButton.textContent = "✓";

    setTimeout(() => {
      copyButton.textContent = "⧉";
    }, 1200);

  } catch {

    alert(
      "Could not copy the address."
    );

  }

}


loadButton.addEventListener(
  "click",
  loadPortfolio
);


refreshButton.addEventListener(
  "click",
  loadPortfolio
);


copyButton.addEventListener(
  "click",
  copyAddress
);


networkSelect.addEventListener(
  "change",
  () => {

    if (currentAddress) {
      loadPortfolio();
    }

  }
);


addressInput.addEventListener(
  "keydown",
  event => {

    if (event.key === "Enter") {
      loadPortfolio();
    }

  }
);
