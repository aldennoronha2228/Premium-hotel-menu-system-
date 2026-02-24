/**
 * Persists menu-item availability overrides in localStorage.
 *
 * This acts as a reliable fallback when Supabase tables haven't been
 * set up yet, and also ensures availability state survives page reloads
 * on the same device.
 *
 * Shape: { [itemId]: boolean }  — true = available, false = off the menu
 */
const LS_KEY = 'hotelmenu_availability';

export function getAvailabilityMap(): Record<string, boolean> {
    if (typeof window === 'undefined') return {};
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

export function setItemAvailability(itemId: string, available: boolean): void {
    if (typeof window === 'undefined') return;
    const map = getAvailabilityMap();
    map[itemId] = available;
    localStorage.setItem(LS_KEY, JSON.stringify(map));
}

/** Apply the stored overrides on top of a list of items */
export function applyAvailabilityOverrides<T extends { id: string; available?: boolean }>(
    items: T[]
): T[] {
    const map = getAvailabilityMap();
    return items.map(item =>
        Object.prototype.hasOwnProperty.call(map, item.id)
            ? { ...item, available: map[item.id] }
            : item
    );
}

/** Seed the map from an initial list (sets only items not already overridden) */
export function seedAvailabilityMap<T extends { id: string; available?: boolean }>(
    items: T[]
): void {
    if (typeof window === 'undefined') return;
    const map = getAvailabilityMap();
    let changed = false;
    for (const item of items) {
        if (!Object.prototype.hasOwnProperty.call(map, item.id) && item.available !== undefined) {
            map[item.id] = item.available;
            changed = true;
        }
    }
    if (changed) localStorage.setItem(LS_KEY, JSON.stringify(map));
}
