const API_URL = "https://api.escuelajs.co/api/v1/products";

// State
let allProducts = [];
let filtered = [];
let currentPage = 1;
let limit = 10;

// Sort state
let sortField = null; // "title" | "price"
let sortDir = null;   // "asc" | "desc" | null

// Elements
const tbody = document.getElementById("tbody");
const searchInput = document.getElementById("searchInput");
const limitSelect = document.getElementById("limitSelect");
const pagination = document.getElementById("pagination");
const pagingInfo = document.getElementById("pagingInfo");
const statusBadge = document.getElementById("statusBadge");
const btnReload = document.getElementById("btnReload");

const sortTitleBtn = document.getElementById("sortTitle");
const sortPriceBtn = document.getElementById("sortPrice");
const sortTitleInd = document.getElementById("sortTitleInd");
const sortPriceInd = document.getElementById("sortPriceInd");

function setStatus(text, type = "secondary") {
  statusBadge.className = `badge text-bg-${type} w-100 text-start`;
  statusBadge.textContent = text;
}

function safeText(v) {
  return (v ?? "").toString();
}

function escapeHtml(str) {
  return safeText(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(str) {
  return escapeHtml(str).replaceAll("\n", " ");
}

function formatPrice(p) {
  const n = Number(p);
  if (Number.isNaN(n)) return safeText(p);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

/**
 * ✅ LẤY ẢNH ĐÚNG THEO API BẠN GỬI
 * - images luôn là array string (url)
 * - trả về danh sách candidate urls: [img1, img2, img3...]
 */
function getImageCandidates(product) {
  const imgs = product?.images;
  if (!Array.isArray(imgs)) return [];
  return imgs
    .filter(x => typeof x === "string")
    .map(x => x.trim())
    .filter(x => x.startsWith("http"));
}

/**
 * Placeholder nếu fail hết
 */
function placeholderUrl(productId) {
  return `https://via.placeholder.com/80?text=${encodeURIComponent(productId ?? "No+Img")}`;
}

/**
 * ✅ Gán ảnh với fallback lần lượt:
 * img[0] -> img[1] -> img[2] -> placeholder
 */
function attachImageWithFallback(imgEl, candidates, productId) {
  const fallbackList = [...candidates, placeholderUrl(productId)];
  let idx = 0;

  const tryNext = () => {
    if (idx >= fallbackList.length) return;
    imgEl.src = fallbackList[idx++];
  };

  imgEl.addEventListener("error", () => {
    tryNext();
  });

  // Start
  tryNext();
}

async function fetchProducts() {
  setStatus("Loading data...", "warning");
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    allProducts = Array.isArray(data) ? data : [];
    setStatus(`Loaded: ${allProducts.length} items`, "success");

    currentPage = 1;
    applyAll();
  } catch (err) {
    console.error(err);
    setStatus("Failed to load data", "danger");
    allProducts = [];
    filtered = [];
    currentPage = 1;
    render();
  }
}

function applyAll() {
  const q = safeText(searchInput.value).trim().toLowerCase();
  filtered = allProducts.filter(p => safeText(p.title).toLowerCase().includes(q));

  if (sortField && sortDir) {
    const dir = sortDir === "asc" ? 1 : -1;
    filtered.sort((a, b) => {
      if (sortField === "title") {
        return safeText(a.title).localeCompare(safeText(b.title)) * dir;
      }
      if (sortField === "price") {
        return (Number(a.price) - Number(b.price)) * dir;
      }
      return 0;
    });
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  if (currentPage > totalPages) currentPage = totalPages;

  render();
}

function setSort(field) {
  if (sortField !== field) {
    sortField = field;
    sortDir = "asc";
  } else {
    if (sortDir === null) sortDir = "asc";
    else if (sortDir === "asc") sortDir = "desc";
    else sortDir = null;
  }

  updateSortIndicators();
  currentPage = 1;
  applyAll();
}

function updateSortIndicators() {
  sortTitleInd.textContent = "↕";
  sortPriceInd.textContent = "↕";
  const arrow = (dir) => dir === "asc" ? "↑" : "↓";
  if (sortField === "title" && sortDir) sortTitleInd.textContent = arrow(sortDir);
  if (sortField === "price" && sortDir) sortPriceInd.textContent = arrow(sortDir);
}

function getPageSlice(arr) {
  const start = (currentPage - 1) * limit;
  return arr.slice(start, start + limit);
}

function render() {
  renderTable();
  renderPagination();
  renderInfo();
  initTooltips();
}

function renderInfo() {
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const start = total === 0 ? 0 : (currentPage - 1) * limit + 1;
  const end = Math.min(total, currentPage * limit);
  pagingInfo.textContent = `Showing ${start}–${end} of ${total} • Page ${currentPage}/${totalPages}`;
}

function renderTable() {
  tbody.innerHTML = "";
  const pageItems = getPageSlice(filtered);

  if (pageItems.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="5" class="text-center text-secondary py-4">No data</td>`;
    tbody.appendChild(tr);
    return;
  }

  for (const p of pageItems) {
    const tr = document.createElement("tr");
    tr.classList.add("hover-row");

    const desc = safeText(p.description);
    const title = safeText(p.title);
    const categoryName = safeText(p.category?.name || "");

    const descPanel = `
      <div class="desc-popover" style="top: 52px; left: 90px;">
        <div class="fw-semibold mb-1">Description</div>
        <div class="text-secondary small">${escapeHtml(desc) || "<em>(empty)</em>"}</div>
      </div>
    `;

    // tạo row HTML (img src sẽ gắn sau bằng JS)
    tr.innerHTML = `
      <td>
        <img
          class="thumb"
          alt="img"
          loading="lazy"
          referrerpolicy="no-referrer"
        />
      </td>

      <td>
        <span class="title-clamp"
          data-bs-toggle="tooltip"
          data-bs-placement="top"
          data-bs-title="${escapeAttr(desc || "No description")}"
        >
          ${escapeHtml(title)}
        </span>
        ${descPanel}
      </td>

      <td class="text-secondary">${escapeHtml(categoryName)}</td>
      <td class="text-end fw-semibold">${escapeHtml(formatPrice(p.price))}</td>
      <td class="text-end text-secondary">${escapeHtml(safeText(p.id))}</td>
    `;

    // ✅ gắn ảnh từ images[] với fallback lần lượt
    const imgEl = tr.querySelector("img.thumb");
    const candidates = getImageCandidates(p);
    attachImageWithFallback(imgEl, candidates, p.id);

    tbody.appendChild(tr);
  }
}

function renderPagination() {
  pagination.innerHTML = "";
  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));

  const makeItem = (label, page, disabled = false, active = false) => {
    const li = document.createElement("li");
    li.className = "page-item" + (disabled ? " disabled" : "") + (active ? " active" : "");
    const a = document.createElement("a");
    a.className = "page-link";
    a.href = "#";
    a.textContent = label;

    a.addEventListener("click", (e) => {
      e.preventDefault();
      if (disabled) return;
      currentPage = page;
      render();
    });

    li.appendChild(a);
    return li;
  };

  pagination.appendChild(makeItem("«", Math.max(1, currentPage - 1), currentPage === 1));

  const windowSize = 5;
  let start = Math.max(1, currentPage - Math.floor(windowSize / 2));
  let end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  if (start > 1) {
    pagination.appendChild(makeItem("1", 1, false, currentPage === 1));
    if (start > 2) {
      const ell = document.createElement("li");
      ell.className = "page-item disabled";
      ell.innerHTML = `<span class="page-link">…</span>`;
      pagination.appendChild(ell);
    }
  }

  for (let i = start; i <= end; i++) {
    pagination.appendChild(makeItem(String(i), i, false, i === currentPage));
  }

  if (end < totalPages) {
    if (end < totalPages - 1) {
      const ell = document.createElement("li");
      ell.className = "page-item disabled";
      ell.innerHTML = `<span class="page-link">…</span>`;
      pagination.appendChild(ell);
    }
    pagination.appendChild(makeItem(String(totalPages), totalPages, false, currentPage === totalPages));
  }

  pagination.appendChild(makeItem("»", Math.min(totalPages, currentPage + 1), currentPage === totalPages));
}

function initTooltips() {
  const nodes = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  nodes.forEach(el => new bootstrap.Tooltip(el));
}

// Events
function handleSearchChange() {
  currentPage = 1;
  applyAll();
}

searchInput.addEventListener("input", handleSearchChange);
searchInput.addEventListener("change", handleSearchChange);

limitSelect.addEventListener("change", () => {
  limit = Number(limitSelect.value);
  currentPage = 1;
  applyAll();
});

sortTitleBtn.addEventListener("click", () => setSort("title"));
sortPriceBtn.addEventListener("click", () => setSort("price"));
btnReload.addEventListener("click", () => fetchProducts());

// Init
updateSortIndicators();
fetchProducts();