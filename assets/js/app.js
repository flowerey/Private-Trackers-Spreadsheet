// Theme switcher component
function themeSwitcher() {
    return {
        isDark: true,
        accentColor: '#6366f1', // Default indigo
        showColorPicker: false,
        accentColors: [
            { name: 'Red', value: '#e74c3c' },
            { name: 'Blue', value: '#3498db' },
            { name: 'Green', value: '#27ae60' },
            { name: 'Purple', value: '#9b59b6' },
            { name: 'Orange', value: '#f39c12' },
            { name: 'Teal', value: '#1abc9c' },
            { name: 'Pink', value: '#e91e63' },
            { name: 'Indigo', value: '#6366f1' }
        ],
        init() {
            const savedTheme = localStorage.getItem('theme');
            const savedAccent = localStorage.getItem('accentColor');

            this.isDark = savedTheme ? savedTheme === 'dark' : true;
            this.accentColor = savedAccent || '#6366f1';

            this.applyTheme();
            this.applyAccentColor();
        },
        toggleTheme() {
            this.isDark = !this.isDark;
            this.applyTheme();
            localStorage.setItem('theme', this.isDark ? 'dark' : 'light');
        },
        setAccentColor(color) {
            this.accentColor = color;
            this.applyAccentColor();
            localStorage.setItem('accentColor', color);
            this.showColorPicker = false;
        },
        applyTheme() {
            document.documentElement.setAttribute(
                'data-theme',
                this.isDark ? 'dark' : 'light'
            );
        },
        applyAccentColor() {
            document.documentElement.style.setProperty('--accent-primary', this.accentColor);

            const hex = this.accentColor.replace('#', '');
            const r = parseInt(hex.substr(0, 2), 16);
            const g = parseInt(hex.substr(2, 2), 16);
            const b = parseInt(hex.substr(4, 2), 16);

            document.documentElement.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
            document.documentElement.style.setProperty('--hover-bg', `rgba(${r}, ${g}, ${b}, 0.05)`);
            document.documentElement.style.setProperty('--gradient-red',
                `linear-gradient(135deg, rgba(${r}, ${g}, ${b}, 0.1), rgba(${r}, ${g}, ${b}, 0.05))`);
            document.documentElement.style.setProperty('--gradient-header',
                `linear-gradient(135deg, rgba(${r}, ${g}, ${b}, 0.1), rgba(${r}, ${g}, ${b}, 0.05))`);
            document.documentElement.style.setProperty('--icon-glow',
                `drop-shadow(0 0 10px rgba(${r}, ${g}, ${b}, 0.5))`);
            document.documentElement.style.setProperty('--text-glow',
                `0 0 10px rgba(${r}, ${g}, ${b}, 0.5)`);
            document.documentElement.style.setProperty('--scrollbar-thumb',
                `rgba(${r}, ${g}, ${b}, 0.3)`);
        }
    }
}

// AlpineJS component for main tracker table
function trackerTable() {
    return {
        trackers: [],
        search: '',
        sortColumn: '',
        sortDirection: 'asc',
        showStickyHeader: false,
        stickyHeaderLeft: 0,
        stickyHeaderWidth: 0,
        selectedTrackers: [],
        showCompareModal: false,
        tooltip: {
            show: false,
            text: '',
            x: 0,
            y: 0
        },

        init() {
            this.loadTrackers();
            this.setupStickyHeader();
        },

        async loadTrackers() {
            try {
                const res = await fetch('./trackers.json');
                const data = await res.json();
                this.trackers = data.trackers || [];
            } catch (e) {
                console.error('Error loading trackers:', e);
            }
        },

        get filteredTrackers() {
            let filtered = this.trackers;

            if (this.search) {
                const s = this.search.toLowerCase();
                filtered = filtered.filter(t =>
                    Object.values(t).some(v => String(v).toLowerCase().includes(s))
                );
            }

            if (this.sortColumn) {
                filtered.sort((a, b) => {
                    let aVal = a[this.sortColumn] ?? '';
                    let bVal = b[this.sortColumn] ?? '';

                    if (['Users', 'Torrents', 'Peers'].includes(this.sortColumn)) {
                        aVal = this.parseNumber(aVal);
                        bVal = this.parseNumber(bVal);
                    } else {
                        aVal = String(aVal).toLowerCase();
                        bVal = String(bVal).toLowerCase();
                    }

                    return this.sortDirection === 'asc'
                        ? aVal > bVal ? 1 : -1
                        : aVal < bVal ? 1 : -1;
                });
            }

            return filtered;
        },

        sortBy(column) {
            if (this.sortColumn === column) {
                this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortColumn = column;
                this.sortDirection = 'asc';
            }
        },

        parseNumber(val) {
            if (!val || val === '-' || val === 'N/A') return -Infinity;
            return parseFloat(String(val).replace(/,/g, '')) || -Infinity;
        },

        showTooltip(e, text) {
            const r = e.target.getBoundingClientRect();
            this.tooltip = {
                show: true,
                text,
                x: r.left + r.width / 2,
                y: r.top - 70
            };
        },

        hideTooltip() {
            this.tooltip.show = false;
        },

        isInSelectedTrackers(tracker) {
            return this.selectedTrackers.some(t => t.Name === tracker.Name);
        },

        toggleTrackerSelection(tracker) {
            if (this.isInSelectedTrackers(tracker)) {
                this.selectedTrackers = this.selectedTrackers.filter(t => t.Name !== tracker.Name);
            } else if (this.selectedTrackers.length < 4) {
                this.selectedTrackers.push(tracker);
            }
        },

        openCompareModal() {
            if (this.selectedTrackers.length >= 2) {
                this.showCompareModal = true;
                document.body.classList.add('modal-open');
            }
        },

        closeCompareModal() {
            this.showCompareModal = false;
            document.body.classList.remove('modal-open');
        },

        removeFromComparison(tracker) {
            this.selectedTrackers = this.selectedTrackers.filter(t => t.Name !== tracker.Name);
            if (this.selectedTrackers.length < 2) this.closeCompareModal();
        },

        setupStickyHeader() {
            const onScroll = () => {
                const container = document.querySelector('.tracker-table__container');
                const header = document.querySelector('.tracker-table__main thead');
                if (!container || !header) return;

                const rect = header.getBoundingClientRect();
                this.showStickyHeader = rect.bottom < 120;
            };

            window.addEventListener('scroll', onScroll);
            window.addEventListener('resize', onScroll);
            onScroll();
        }
    }
}
