export const state = {
    phase: 'boot',
    screen: 'loading',
    message: 'Initializing session...',
    error: '',
    device: null,
    items: [],
    filteredByGroup: {
        System: [],
        User: [],
    },
    cursorByGroup: {
        System: 0,
        User: 0,
    },
    scrollByGroup: {
        System: 0,
        User: 0,
    },
    activePane: 'System',
    query: '',
    selected: new Set(),
    pending: [],
    currentPackage: '',
    progressIndex: 0,
    successCount: 0,
    failCount: 0,
    running: true,
};

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function createItems(sysPackages, userPackages) {
    return [
        ...sysPackages.map((pkg) => ({ pkg, group: 'System' })),
        ...userPackages.map((pkg) => ({ pkg, group: 'User' })),
    ];
}

export function filterItems() {
    const query = state.query.trim().toLowerCase();
    state.filteredByGroup.System = state.items.filter((item) => (
        item.group === 'System' &&
        (!query || item.pkg.toLowerCase().includes(query) || item.group.toLowerCase().includes(query))
    ));
    state.filteredByGroup.User = state.items.filter((item) => (
        item.group === 'User' &&
        (!query || item.pkg.toLowerCase().includes(query) || item.group.toLowerCase().includes(query))
    ));

    for (const group of ['System', 'User']) {
        const list = state.filteredByGroup[group];
        if (list.length === 0) {
            state.cursorByGroup[group] = 0;
            state.scrollByGroup[group] = 0;
            continue;
        }
        state.cursorByGroup[group] = clamp(state.cursorByGroup[group], 0, list.length - 1);
        syncScroll(group);
    }

    if (state.filteredByGroup[state.activePane].length === 0) {
        state.activePane = state.filteredByGroup.System.length > 0 ? 'System' : 'User';
    }
}

let getListHeightRef = () => 0;

export function setListHeightResolver(fn) {
    getListHeightRef = fn;
}

export function syncScroll(group = state.activePane) {
    const list = state.filteredByGroup[group];
    const listHeight = getListHeightRef();
    if (listHeight <= 0 || list.length === 0) {
        state.scrollByGroup[group] = 0;
        return;
    }
    if (state.cursorByGroup[group] < state.scrollByGroup[group]) {
        state.scrollByGroup[group] = state.cursorByGroup[group];
    }
    const lastVisible = state.scrollByGroup[group] + listHeight - 1;
    if (state.cursorByGroup[group] > lastVisible) {
        state.scrollByGroup[group] = state.cursorByGroup[group] - listHeight + 1;
    }
    const maxScroll = Math.max(0, list.length - listHeight);
    state.scrollByGroup[group] = clamp(state.scrollByGroup[group], 0, maxScroll);
}

export function moveCursor(delta) {
    const group = state.activePane;
    const list = state.filteredByGroup[group];
    if (list.length === 0) return;
    state.cursorByGroup[group] = clamp(state.cursorByGroup[group] + delta, 0, list.length - 1);
    syncScroll(group);
}

export function switchPane(direction) {
    const oldPane = state.activePane;
    const nextPane = direction > 0 ? 'User' : 'System';

    if (oldPane === nextPane) return;

    const nextList = state.filteredByGroup[nextPane];
    if (nextList.length > 0) {
        // Get relative vertical position on screen
        const relativeIndex = state.cursorByGroup[oldPane] - state.scrollByGroup[oldPane];

        state.activePane = nextPane;

        // Apply the same relative position to the new pane
        state.cursorByGroup[nextPane] = clamp(
            state.scrollByGroup[nextPane] + relativeIndex,
            0,
            nextList.length - 1
        );

        syncScroll(nextPane);
    }
}

export function toggleCurrent() {
    const item = getCurrentItem();
    if (!item) return;
    if (state.selected.has(item.pkg)) {
        state.selected.delete(item.pkg);
    } else {
        state.selected.add(item.pkg);
    }
}

export function getCurrentItem() {
    const group = state.activePane;
    return state.filteredByGroup[group][state.cursorByGroup[group]] || null;
}

export function summaryStats() {
    const systemCount = state.items.filter((item) => item.group === 'System').length;
    const userCount = state.items.length - systemCount;
    return { systemCount, userCount };
}
