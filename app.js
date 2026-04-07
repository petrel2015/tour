const timelineEl = document.getElementById("timeline");
const summaryEl = document.getElementById("summary");
const mapFooterEl = document.getElementById("mapFooter");

let map;
const markers = new Map();
const listItems = new Map();
const labelMarkers = [];
const arrowMarkers = [];
let routeLine;
let globalBounds = [];

const modeColors = {
  flight: "#c64a2f",
  drive: "#1c6e8c",
  walk: "#6a8f2a",
};

fetch("data/itinerary.json")
  .then((res) => res.json())
  .then((data) => {
    renderSummary(data);
    renderTimeline(data.days);
    initMap(data.days);
    syncMainHeight();
  })
  .catch(() => {
    timelineEl.innerHTML = "<p>无法加载行程数据。</p>";
  });

window.addEventListener("resize", syncMainHeight);

function syncMainHeight() {
  const mainEl = document.querySelector(".main");
  const headerEl = document.querySelector(".hero");
  if (!mainEl || !headerEl) return;
  const headerRect = headerEl.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const verticalPadding = 24;
  const available = Math.max(viewportHeight - headerRect.height - verticalPadding, 320);
  mainEl.style.height = `${available}px`;
}

function renderSummary(data) {
  const totalItems = data.days.reduce((sum, day) => sum + day.items.length, 0);
  summaryEl.textContent = `${data.title} · ${data.days.length} 天 · ${totalItems} 个行程点`;
}

function renderTimeline(days) {
  timelineEl.innerHTML = "";

  days.forEach((day) => {
    const dayEl = document.createElement("div");
    dayEl.className = "day";

    const titleEl = document.createElement("h3");
    titleEl.className = "day-title";
    titleEl.textContent = `${day.date} · ${day.city}`;

    dayEl.appendChild(titleEl);

    day.items.forEach((item) => {
      const itemEl = document.createElement("div");
      itemEl.className = "item";
      itemEl.dataset.itemId = item.id;

      const headEl = document.createElement("div");
      headEl.className = "item-head";

      const timeEl = document.createElement("div");
      timeEl.className = "item-time";
      timeEl.textContent = item.time;

      const tagEl = document.createElement("div");
      tagEl.className = "item-tag";
      tagEl.textContent = formatTag(item);

      headEl.appendChild(timeEl);
      headEl.appendChild(tagEl);

      const placeEl = document.createElement("div");
      placeEl.className = "item-place";
      placeEl.textContent = item.place;

      const detailEl = document.createElement("div");
      detailEl.className = "item-detail markdown";
      detailEl.innerHTML = markdownToHtml(item.detail);

      itemEl.appendChild(headEl);
      itemEl.appendChild(placeEl);
      itemEl.appendChild(detailEl);

      itemEl.addEventListener("click", () => focusItem(item.id));

      listItems.set(item.id, itemEl);
      dayEl.appendChild(itemEl);
    });

    timelineEl.appendChild(dayEl);
  });
}

function initMap(days) {
  map = L.map("map", { scrollWheelZoom: true });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
    maxZoom: 18,
  }).addTo(map);

  const bounds = [];
  const orderedItems = [];

  days.forEach((day) => {
    day.items.forEach((item) => {
      const color = modeColors[item.mode] || modeColors.walk;
      const marker = L.circleMarker([item.lat, item.lng], {
        radius: 8,
        color,
        fillColor: color,
        fillOpacity: 0.85,
      }).addTo(map);

      marker.bindPopup(renderPopup(item), { maxWidth: 240 });
      marker.on("click", () => focusItem(item.id));

      markers.set(item.id, marker);
      bounds.push([item.lat, item.lng]);
      orderedItems.push(item);

      const label = L.marker([item.lat, item.lng], {
        icon: L.divIcon({
          className: "pin-label",
          html: `<div>${item.time} · ${escapeHtml(item.place)}</div>`,
          iconSize: [140, 28],
          iconAnchor: [-4, 14],
        }),
        interactive: false,
      }).addTo(map);
      labelMarkers.push(label);
    });
  });

  if (bounds.length) {
    globalBounds = bounds;
    map.fitBounds(bounds, { padding: [30, 30] });
  }

  if (orderedItems.length > 1) {
    const latlngs = orderedItems.map((item) => [item.lat, item.lng]);
    routeLine = L.polyline(latlngs, {
      color: "#1c6e8c",
      weight: 3,
      opacity: 0.7,
    }).addTo(map);

    for (let i = 0; i < latlngs.length - 1; i += 1) {
      const start = latlngs[i];
      const end = latlngs[i + 1];
      const mid = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
      const angle = bearing(start[0], start[1], end[0], end[1]);
      const arrow = L.marker(mid, {
        icon: L.divIcon({
          className: "arrow-icon",
          html: `<div style="transform: rotate(${angle}deg);">➤</div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        }),
        interactive: false,
      }).addTo(map);
      arrowMarkers.push(arrow);
    }
  }
}

const resetBtn = document.getElementById("resetView");
if (resetBtn) {
  resetBtn.addEventListener("click", () => {
    listItems.forEach((el) => el.classList.remove("active"));
    if (map && globalBounds.length) {
      map.fitBounds(globalBounds, { padding: [30, 30] });
    }
    mapFooterEl.textContent = "点击列表或地图点位查看详情";
  });
}

function focusItem(itemId) {
  const marker = markers.get(itemId);
  const listEl = listItems.get(itemId);
  if (!marker || !listEl) return;

  listItems.forEach((el) => el.classList.remove("active"));
  listEl.classList.add("active");
  listEl.scrollIntoView({ behavior: "smooth", block: "center" });

  map.setView(marker.getLatLng(), Math.max(map.getZoom(), 12), { animate: true });
  marker.openPopup();

  mapFooterEl.textContent = listEl.querySelector(".item-place").textContent;
}

function formatTag(item) {
  const modeLabel = {
    flight: "飞行",
    drive: "自驾/城际",
    walk: "步行/市内",
  };

  if (item.mode === "flight" && item.flightNo) {
    return `${modeLabel.flight} · ${item.flightNo}`;
  }

  return `${modeLabel[item.mode] || "步行/市内"} · ${item.detailType}`;
}

function renderPopup(item) {
  return `
    <div>
      <strong>${item.time} · ${item.place}</strong>
      <div style="margin-top:6px;font-size:12px;color:#6e6a65;">${item.detailType} · ${formatTransit(item)}</div>
      <div style="margin-top:8px;font-size:12px;color:#333;">${markdownToHtml(item.detail)}</div>
    </div>
  `;
}

function formatTransit(item) {
  if (item.mode === "flight" && item.flightNo) {
    return `航班 ${item.flightNo}`;
  }
  return item.mode === "drive" ? "城际/自驾" : "市内步行";
}

function markdownToHtml(markdown) {
  if (!markdown) return "";
  const lines = markdown.split("\n").map((line) => line.trim());
  let html = "";
  let inList = false;

  lines.forEach((line) => {
    if (line.startsWith("- ")) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      html += `<li>${escapeHtml(line.slice(2))}</li>`;
      return;
    }

    if (inList) {
      html += "</ul>";
      inList = false;
    }

    if (line) {
      html += `<p>${escapeHtml(line)}</p>`;
    }
  });

  if (inList) {
    html += "</ul>";
  }

  return html;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function bearing(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const dLon = toRad(lng2 - lng1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}
