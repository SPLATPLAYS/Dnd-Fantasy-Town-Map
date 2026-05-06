export function createDefaultMap(w = 40, h = 30) {
    return {
        name: 'my-town',
        width: w, height: h,
        tiles: {},
        buildings: [],
        entities: []
    };
}

let _idCounter = 1;
export function createEntitiesBulk(count = 5, race = 'Human', role = 'Farmer', town = 'my-town') {
    const arr = [];
    for (let i = 0; i < count; i++) {
        arr.push({ id: `e${_idCounter++}`, name: `${race} ${_idCounter}`, race, role, residence: null, workplace: null, town });
    }
    return arr;
}
