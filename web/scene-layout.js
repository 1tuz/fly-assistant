export const BOOKS_POSITION = Object.freeze([-0.27, 0.355, -0.15]);
export const SHELF_LABEL_SIZE = Object.freeze([1.1, 0.28]);

export function shelfLabelPosition(height) {
    return [0, height + SHELF_LABEL_SIZE[1] / 2 + 0.55, -0.45];
}

export function taskObjectPosition(position, onShelf, scale = 0.5) {
    return [position[0] * scale, onShelf ? 0 : (position[1] + 0.4) * scale, position[2] * scale];
}

export function tripodPhase(name, side, phase) {
    return phase + ((name === 'T2') === (side > 0) ? 0 : Math.PI);
}
