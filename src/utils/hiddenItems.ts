type Scope = 'user' | 'admin';
type ItemType = 'analysis' | 'chat';

function getKey(scope: Scope, type: ItemType): string {
  return `hh_hidden_${scope}_${type}`;
}

export function getHiddenIds(scope: Scope, type: ItemType): Set<string> {
  try {
    const raw = localStorage.getItem(getKey(scope, type));
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

export function hideItem(scope: Scope, type: ItemType, id: string): void {
  const hidden = getHiddenIds(scope, type);
  hidden.add(id);
  localStorage.setItem(getKey(scope, type), JSON.stringify([...hidden]));
}

export function unhideItem(scope: Scope, type: ItemType, id: string): void {
  const hidden = getHiddenIds(scope, type);
  hidden.delete(id);
  localStorage.setItem(getKey(scope, type), JSON.stringify([...hidden]));
}

export function isItemHidden(scope: Scope, type: ItemType, id: string): boolean {
  return getHiddenIds(scope, type).has(id);
}
