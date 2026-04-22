import chalk from 'chalk';
import { state, summaryStats, getCurrentItem } from './state.js';

export function stripAnsi(text) {
    return String(text).replace(/\x1B\[[0-9;]*m/g, '');
}

export function pad(text, width) {
    const plainLength = stripAnsi(text).length;
    if (plainLength >= width) return text;
    return text + ' '.repeat(width - plainLength);
}

export function truncate(text, width) {
    if (width <= 0) return '';
    const plain = stripAnsi(text);
    if (plain.length <= width) return pad(text, width);
    if (width === 1) return '…';
    return plain.slice(0, width - 1) + '…';
}

export function line(width, left = '', right = '') {
    const rightText = right ? ` ${right}` : '';
    const available = Math.max(0, width - stripAnsi(rightText).length);
    return truncate(left, available) + rightText;
}

export function fullWidthRule(width, color = chalk.dim) {
    return color('─'.repeat(Math.max(0, width)));
}

export function getTerminalSize() {
    return {
        width: process.stdout.columns || 100,
        height: process.stdout.rows || 32,
    };
}

export function getListHeight() {
    const { height } = getTerminalSize();
    return Math.max(1, height - 10);
}

export function renderLoading(width, height) {
    const rows = [];
    rows.push(chalk.white.bold('SACA'));
    rows.push(chalk.dim('Full-screen ADB debloat session'));
    rows.push('');
    rows.push(chalk.cyan(state.message));
    while (rows.length < height - 2) rows.push('');
    rows.push(fullWidthRule(width));
    rows.push(chalk.dim('Waiting for ADB response...'));
    return rows;
}

export function renderError(width, height) {
    const rows = [];
    rows.push(chalk.red.bold('Connection Error'));
    rows.push('');
    for (const part of state.error.split('\n')) rows.push(chalk.white(part));
    rows.push('');
    rows.push(chalk.dim('Press Ctrl+Q or Ctrl+C to exit.'));
    while (rows.length < height) rows.push('');
    return rows.slice(0, height);
}

export function renderHeader(width) {
    const device = state.device;
    const deviceName = device ? [device.brand, device.model].filter(Boolean).join(' ').trim() : 'No device';
    const right = state.query ? chalk.yellow(`filter: ${state.query}`) : chalk.dim('filter: all');
    return [
        line(width, chalk.white.bold('SACA'), chalk.dim('FULL SCREEN')),
        line(width, chalk.dim(deviceName || 'Unknown device'), right),
        fullWidthRule(width),
    ];
}

export function renderFooter(width, left = '', right = '') {
    return [line(width, chalk.dim(left), chalk.dim(right))];
}

export function renderList(width, height) {
    const rows = [];
    const { systemCount, userCount } = summaryStats();
    const selectedCount = state.selected.size;
    const current = getCurrentItem();
    const systemVisible = state.filteredByGroup.System.slice(state.scrollByGroup.System, state.scrollByGroup.System + Math.max(4, height - 6));
    const userVisible = state.filteredByGroup.User.slice(state.scrollByGroup.User, state.scrollByGroup.User + Math.max(4, height - 6));

    rows.push(line(width, chalk.white(`Packages ${chalk.dim(`(${state.items.length})`)}`), chalk.dim(`selected ${selectedCount}`)));
    rows.push(line(width, chalk.dim(`system ${state.filteredByGroup.System.length}/${systemCount}  |  user ${state.filteredByGroup.User.length}/${userCount}`), chalk.dim(`focus ${state.activePane.toLowerCase()}`)));
    rows.push(fullWidthRule(width));

    const leftWidth = Math.max(20, Math.floor((width - 3) / 2));
    const rightWidth = Math.max(20, width - leftWidth - 3);
    const maxPaneHeight = Math.max(4, height - 5);

    const renderPane = (group, visible, paneWidth) => {
        const paneRows = [];
        const isActivePane = state.activePane === group;
        const title = isActivePane ? chalk.cyan.bold(`${group} Apps`) : chalk.white(`${group} Apps`);
        const count = chalk.dim(`(${state.filteredByGroup[group].length})`);
        paneRows.push(line(paneWidth, title, count));
        paneRows.push(chalk.dim('─'.repeat(Math.max(0, paneWidth))));

        if (visible.length === 0) {
            paneRows.push(chalk.yellow('No matches'));
            paneRows.push(chalk.dim('Adjust filter'));
        } else {
            for (let index = 0; index < visible.length; index++) {
                const absoluteIndex = state.scrollByGroup[group] + index;
                const item = visible[index];
                const isActive = isActivePane && absoluteIndex === state.cursorByGroup[group];
                const isSelected = state.selected.has(item.pkg);
                const marker = isActive ? chalk.cyan('❯') : ' ';
                const bullet = isSelected ? chalk.green('●') : chalk.dim('○');
                const pkgColor = isSelected ? chalk.green : (isActive ? chalk.white : chalk.dim);
                const rowText = `${marker} ${bullet} ${item.pkg}`;
                const formattedRow = line(paneWidth, isActive ? chalk.bold(rowText) : rowText);
                paneRows.push(pkgColor(formattedRow));
            }
        }
        return paneRows.slice(0, maxPaneHeight);
    };

    const leftPane = renderPane('System', systemVisible, leftWidth);
    const rightPane = renderPane('User', userVisible, rightWidth);
    const paneHeight = Math.max(leftPane.length, rightPane.length);

    for (let i = 0; i < paneHeight; i++) {
        rows.push(`${pad(leftPane[i] || '', leftWidth)} ${chalk.dim('│')} ${pad(rightPane[i] || '', rightWidth)}`);
    }

    const info = current ? `${current.pkg}  |  ${current.group} app` : 'No package selected';
    while (rows.length < height - 2) rows.push('');
    rows.push(fullWidthRule(width));
    rows.push(...renderFooter(width, info, 'up/down move | left/right switch | space toggle | enter review | esc clear | ctrl+q quit'));
    return rows.slice(0, height);
}

export function renderConfirm(width, height) {
    const rows = [];
    const pending = state.pending;
    rows.push(chalk.white.bold('Review Selection'));
    rows.push(chalk.dim(`Ready to uninstall ${pending.length} package(s) for user 0.`));
    rows.push(fullWidthRule(width));
    for (const pkg of pending.slice(0, Math.max(3, height - 6))) rows.push(chalk.red(`- ${pkg}`));
    if (pending.length > Math.max(3, height - 6)) rows.push(chalk.dim(`... and ${pending.length - Math.max(3, height - 6)} more`));
    while (rows.length < height - 2) rows.push('');
    rows.push(fullWidthRule(width));
    rows.push(...renderFooter(width, 'Press Enter to confirm', 'Enter confirm | Esc back | ctrl+q quit'));
    return rows.slice(0, height);
}

export function renderRunning(width, height) {
    const rows = [];
    rows.push(chalk.white.bold('Uninstalling Packages'));
    rows.push(chalk.dim(`Processing ${state.progressIndex}/${state.pending.length}`));
    rows.push(fullWidthRule(width));
    const barWidth = Math.max(10, width - 10);
    const ratio = state.pending.length === 0 ? 0 : state.progressIndex / state.pending.length;
    const filled = Math.round(barWidth * ratio);
    const bar = chalk.cyan('█'.repeat(filled)) + chalk.dim('░'.repeat(Math.max(0, barWidth - filled)));
    rows.push(bar);
    rows.push('');
    rows.push(line(width, chalk.white(state.currentPackage || 'Preparing...'), chalk.dim(`${state.successCount} ok / ${state.failCount} failed`)));
    while (rows.length < height - 2) rows.push('');
    rows.push(fullWidthRule(width));
    rows.push(...renderFooter(width, 'Working...', 'Do not disconnect the device'));
    return rows.slice(0, height);
}

export function renderSummary(width, height) {
    const rows = [];
    rows.push(chalk.white.bold('Summary'));
    rows.push(chalk.green(`Success: ${state.successCount}`));
    rows.push(state.failCount > 0 ? chalk.red(`Failed: ${state.failCount}`) : chalk.dim('Failed: 0'));
    rows.push(fullWidthRule(width));
    rows.push(chalk.dim('Press Enter or Esc to return to the list. Press Ctrl+Q or Ctrl+C to exit.'));
    while (rows.length < height) rows.push('');
    return rows.slice(0, height);
}

let lastFrame = '';

export function render() {
    if (!state.running) return;
    const { width, height } = getTerminalSize();
    const bodyHeight = Math.max(6, height - 3);
    let rows;
    if (state.screen === 'loading') rows = renderLoading(width, height);
    else if (state.screen === 'error') rows = renderError(width, height);
    else if (state.screen === 'list') rows = [...renderHeader(width), ...renderList(width, bodyHeight)];
    else if (state.screen === 'confirm') rows = [...renderHeader(width), ...renderConfirm(width, bodyHeight)];
    else if (state.screen === 'running') rows = [...renderHeader(width), ...renderRunning(width, bodyHeight)];
    else rows = [...renderHeader(width), ...renderSummary(width, bodyHeight)];

    while (rows.length < height) rows.push('');
    const frame = rows.slice(0, height).map((row) => truncate(row, width)).join('\n');

    if (frame !== lastFrame) {
        process.stdout.write('\x1b[H' + frame + '\x1b[J');
        lastFrame = frame;
    }
}
