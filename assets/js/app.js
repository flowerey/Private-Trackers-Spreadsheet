function themeSwitcher() {
  return {
    isDark: true,
    accentColor: "#7c4dff",
    showColorPicker: false,
    accentColors: [
      { name: "Indigo", value: "#6366f1" },
      { name: "Violet", value: "#7c4dff" },
      { name: "Blue", value: "#388bfd" },
      { name: "Teal", value: "#2dd4bf" },
      { name: "Green", value: "#238636" },
      { name: "Yellow", value: "#d29922" },
      { name: "Orange", value: "#f78166" },
      { name: "Red", value: "#fb7185" },
    ],
    init() {
      const savedTheme = localStorage.getItem("theme");
      const savedAccent = localStorage.getItem("accentColor");

      this.isDark = savedTheme ? savedTheme === "dark" : true;
      this.accentColor = savedAccent || "#7c4dff";

      this.applyTheme();
      this.applyAccentColor();
    },
    toggleTheme() {
      this.isDark = !this.isDark;
      this.applyTheme();
      localStorage.setItem("theme", this.isDark ? "dark" : "light");
    },
    setAccentColor(color) {
      this.accentColor = color;
      this.applyAccentColor();
      localStorage.setItem("accentColor", color);
      this.showColorPicker = false;
    },
    applyTheme() {
      document.documentElement.setAttribute(
        "data-theme",
        this.isDark ? "dark" : "light",
      );
    },
    applyAccentColor() {
      document.documentElement.style.setProperty(
        "--accent-primary",
        this.accentColor,
      );

      const hex = this.accentColor.replace("#", "");
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      document.documentElement.style.setProperty(
        "--accent-glow",
        `rgba(${r}, ${g}, ${b}, 0.2)`,
      );
    },
  };
}

function trackerTable() {
  return {
    trackers: [],
    search: "",
    sortColumn: "Name",
    sortDirection: "asc",
    selectedTrackers: [],
    showCompareModal: false,
    activeTypeFilter: "All",

    stats: {
      count: 0,
      users: 0,
      torrents: 0,
      peers: 0,
    },

    init() {
      this.loadTrackers();
    },

    async loadTrackers() {
      try {
        const res = await fetch("./trackers.json");
        const data = await res.json();
        this.trackers = data.trackers || [];
        this.calculateStats();
      } catch (e) {
        console.error("Error loading trackers:", e);
      }
    },

    calculateStats() {
      this.stats.count = this.trackers.length;

      const sumField = (field) => {
        return this.trackers.reduce((acc, t) => {
          const val = t[field];
          if (!val || val === "-") return acc;
          const num = parseInt(val.replace(/,/g, ""));
          return acc + (isNaN(num) ? 0 : num);
        }, 0);
      };

      this.stats.users = sumField("Users");
      this.stats.torrents = sumField("Torrents");
      this.stats.peers = sumField("Peers");
    },

    formatNumber(num) {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
      if (num >= 1000) return (num / 1000).toFixed(1) + "K";
      return num;
    },

    get uniqueTypes() {
      const types = new Set(["All"]);
      this.trackers.forEach((t) => {
        if (t.Type) {
          t.Type.split(",").forEach((s) => types.add(s.trim()));
        }
      });
      return Array.from(types).sort();
    },

    get filteredTrackers() {
      let filtered = this.trackers;

      if (this.search) {
        const s = this.search.toLowerCase();
        filtered = filtered.filter((t) =>
          Object.values(t).some((v) => String(v).toLowerCase().includes(s)),
        );
      }

      if (this.activeTypeFilter !== "All") {
        filtered = filtered.filter(
          (t) => t.Type && t.Type.includes(this.activeTypeFilter),
        );
      }

      if (this.sortColumn) {
        filtered.sort((a, b) => {
          let aVal = a[this.sortColumn] ?? "";
          let bVal = b[this.sortColumn] ?? "";

          if (["Users", "Torrents", "Peers"].includes(this.sortColumn)) {
            aVal = this.parseNumber(aVal);
            bVal = this.parseNumber(bVal);
          } else if (this.sortColumn === "Updated") {
            aVal = new Date(aVal || 0);
            bVal = new Date(bVal || 0);
          } else {
            aVal = String(aVal).toLowerCase();
            bVal = String(bVal).toLowerCase();
          }

          if (aVal === bVal) return 0;
          const res = aVal > bVal ? 1 : -1;
          return this.sortDirection === "asc" ? res : -res;
        });
      }

      return filtered;
    },

    sortBy(column) {
      if (this.sortColumn === column) {
        this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
      } else {
        this.sortColumn = column;
        this.sortDirection = "asc";
      }
    },

    parseNumber(val) {
      if (!val || val === "-" || val === "N/A") return -Infinity;
      return parseFloat(String(val).replace(/,/g, "")) || -Infinity;
    },

    getBadgeClass(val) {
      if (!val || val === "-") return "";
      const v = val.toLowerCase();
      if (["yes", "easy", "open"].includes(v)) return "badge--success";
      if (["moderate", "application", "invite"].includes(v))
        return "badge--warning";
      if (["no", "tough", "closed", "unreasonable"].includes(v))
        return "badge--error";
      return "badge--info";
    },

    isInSelectedTrackers(tracker) {
      return this.selectedTrackers.some((t) => t.Name === tracker.Name);
    },

    toggleTrackerSelection(tracker) {
      if (this.isInSelectedTrackers(tracker)) {
        this.selectedTrackers = this.selectedTrackers.filter(
          (t) => t.Name !== tracker.Name,
        );
      } else if (this.selectedTrackers.length < 4) {
        this.selectedTrackers.push(tracker);
      }
    },

    openCompareModal() {
      if (this.selectedTrackers.length >= 2) {
        this.showCompareModal = true;
        document.body.style.overflow = "hidden";
      }
    },

    closeCompareModal() {
      this.showCompareModal = false;
      document.body.style.overflow = "";
    },

    removeFromComparison(tracker) {
      this.selectedTrackers = this.selectedTrackers.filter(
        (t) => t.Name !== tracker.Name,
      );
      if (this.selectedTrackers.length < 2) this.closeCompareModal();
    },
  };
}
