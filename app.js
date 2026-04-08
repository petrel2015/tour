const timelineEl = document.getElementById("timeline");
const summaryEl = document.getElementById("summary");
const pageTitleEl = document.getElementById("pageTitle");
const pageSubEl = document.getElementById("pageSub");

let map;
const markers = new Map();
const listItems = new Map();
const labelMarkers = new Map();
const arrowMarkers = [];
let routeLine;
let globalBounds = [];
let orderedItems = [];

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
  })
  .catch(() => {
    timelineEl.innerHTML = "<p>无法加载行程数据。</p>";
  });

initListToggle();

function renderSummary(data) {
  const totalItems = data.days.reduce((sum, day) => sum + day.items.length, 0);
  summaryEl.textContent = `${data.title} · ${data.days.length} 天 · ${totalItems} 个行程点`;
  if (pageTitleEl) {
    pageTitleEl.textContent = data.title || "行程标题";
  }
  if (pageSubEl) {
    const rangeText = data.range?.start && data.range?.end ? `${data.range.start} 至 ${data.range.end}` : "日期范围";
    pageSubEl.textContent = rangeText;
  }
  if (data.title) {
    document.title = data.title;
  }
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

      const toggleLabel = document.createElement("label");
      toggleLabel.className = "toggle";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = item.showOnMap !== false;
      checkbox.dataset.itemId = item.id;

      const toggleText = document.createElement("span");
      toggleText.textContent = "地图";

      toggleLabel.appendChild(checkbox);
      toggleLabel.appendChild(toggleText);

      const timeEl = document.createElement("div");
      timeEl.className = "item-time";
      timeEl.textContent = item.time;

      const tagEl = document.createElement("div");
      tagEl.className = "item-tag";
      tagEl.textContent = formatTag(item);

      headEl.appendChild(toggleLabel);
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
      checkbox.addEventListener("click", (event) => event.stopPropagation());
      checkbox.addEventListener("change", (event) => {
        setItemVisibility(item.id, event.target.checked);
      });

      listItems.set(item.id, itemEl);
      dayEl.appendChild(itemEl);
    });

    timelineEl.appendChild(dayEl);
  });
}

function initMap(days) {
  map = L.map("map", { scrollWheelZoom: true, zoomControl: false });
  L.control.zoom({ position: "topright" }).addTo(map);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
    maxZoom: 18,
  }).addTo(map);

  const bounds = [];
  orderedItems = [];

  days.forEach((day, dayIndex) => {
    day.items.forEach((item) => {
      const meta = { ...item, dayIndex: dayIndex + 1, date: day.date };
      const color = modeColors[item.mode] || modeColors.walk;
      const marker = L.circleMarker([meta.lat, meta.lng], {
        radius: 8,
        color,
        fillColor: color,
        fillOpacity: 0.85,
      }).addTo(map);

      marker.bindPopup(renderPopup(meta), { maxWidth: 260 });
      marker.on("click", () => focusItem(meta.id));

      markers.set(meta.id, marker);
      bounds.push([meta.lat, meta.lng]);
      orderedItems.push(meta);

      const label = L.marker([meta.lat, meta.lng], {
        icon: L.divIcon({
          className: "pin-label",
          html: `<div>${meta.date} · D${meta.dayIndex} · ${meta.time} · ${escapeHtml(meta.place)}</div>`,
          iconSize: [240, 28],
          iconAnchor: [-4, 14],
        }),
        interactive: false,
      }).addTo(map);
      labelMarkers.set(meta.id, label);

      if (meta.showOnMap === false) {
        map.removeLayer(marker);
        map.removeLayer(label);
      }
    });
  });

  if (bounds.length) {
    globalBounds = bounds;
    map.fitBounds(bounds, { padding: [30, 30] });
  }

  rebuildRoute();
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
      <strong>${item.date} · D${item.dayIndex} · ${item.time} · ${item.place}</strong>
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

function setItemVisibility(itemId, visible) {
  const marker = markers.get(itemId);
  const label = labelMarkers.get(itemId);
  if (marker) {
    if (visible) {
      marker.addTo(map);
    } else {
      map.removeLayer(marker);
    }
  }
  if (label) {
    if (visible) {
      label.addTo(map);
    } else {
      map.removeLayer(label);
    }
  }
  rebuildRoute();
}

function rebuildRoute() {
  if (routeLine) {
    map.removeLayer(routeLine);
    routeLine = null;
  }
  arrowMarkers.forEach((arrow) => map.removeLayer(arrow));
  arrowMarkers.length = 0;

  const visibleItems = orderedItems.filter((item) => {
    const marker = markers.get(item.id);
    return marker && map.hasLayer(marker);
  });

  if (visibleItems.length > 1) {
    const latlngs = visibleItems.map((item) => [item.lat, item.lng]);
    routeLine = L.polyline(latlngs, {
      color: "#1c6e8c",
      weight: 3,
      opacity: 0.7,
    }).addTo(map);

    for (let i = 0; i < latlngs.length - 1; i += 1) {
      const start = latlngs[i];
      const end = latlngs[i + 1];
      const mid = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
      const angle = bearing(start[0], start[1], end[0], end[1]) - 90;
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

  if (map) {
    map.invalidateSize();
    if (visibleItems.length) {
      const visibleBounds = visibleItems.map((item) => [item.lat, item.lng]);
      map.fitBounds(visibleBounds, { padding: [30, 30] });
    }
  }
}

function initListToggle() {
  const toggleBtn = document.getElementById("listToggle");
  const listPanel = document.getElementById("listPanel");
  const minimizeBtn = document.getElementById("minimizeList");
  if (!toggleBtn || !listPanel) return;

  const openList = () => {
    listPanel.classList.remove("hidden");
    toggleBtn.classList.add("hidden");
    toggleBtn.setAttribute("aria-expanded", "true");
    if (map) map.invalidateSize();
  };

  const closeList = () => {
    listPanel.classList.add("hidden");
    toggleBtn.classList.remove("hidden");
    toggleBtn.setAttribute("aria-expanded", "false");
    if (map) map.invalidateSize();
  };

  if (listPanel.classList.contains("hidden")) {
    toggleBtn.classList.remove("hidden");
  } else {
    toggleBtn.classList.add("hidden");
  }

  toggleBtn.addEventListener("click", openList);
  if (minimizeBtn) {
    minimizeBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      closeList();
    });
  }
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
