import * as THREE from 'three';
import {canSee} from "./engin.js";

export class Tile {
    static geometry = new THREE.BoxGeometry(1, 1, 1);
    /** @type {int}*/
    x
    /** @type {int}*/
    z
    /** @type {int}*/
    h
    /** @type {int}*/
    r
    /** @type {int}*/
    g
    /** @type {int}*/
    b
    /** @type {Board}*/
    map
    /** @type {Mesh}*/
    object

    /**
     * @param {number} x
     * @param {number} z
     * @param {number} h
     * @param {number} r
     * @param {number} g
     * @param {number} b
     * @param {Board} map
     * @param {THREE.Object3D} root
     */
    constructor(x, z, h, r, g, b, map, root) {
        this.x = x;
        this.z = z
        this.h = h
        this.r = r;
        this.g = g;
        this.b = b;
        this.map = map;
        this.gen_object(root)
    }

    /**
     * @param {THREE.Object3D} root
     */
    gen_object(root) {
        let height = this.h / 2;

        let material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(this.r / 255, this.g / 255, this.b / 255), roughness: 0.6, metalness: 0.2
        });

        this.object = new THREE.Mesh(Tile.geometry, material);
        this.object.position.set(this.x, height / 2, this.z);
        this.object.scale.y = height;
        this.object.userData = this
        root.add(this.object);
    }
}

export class Board {
    /** @type {Tile[][]} */
    data = []
    /** @type {Map.<int,Piece>} */
    pieces = new Map()
    /** @type {Tile[]} */
    tiles = []
    /** @type {function} */
    on_load
    /** @type {string} */
    local_side

    /**
     * @param {string} url
     * @param {THREE.Object3D} root
     * @param {string} side
     * @param {function} on_load
     */
    constructor(url, root, side, on_load) {
        this.load(url, root);
        this.on_load = on_load;
        this.local_side = side
    }

    /**
     * @param {number} x
     * @param {number} z
     * @return {Tile}
     */
    tile(x, z) {
        return this.data[z][x]
    }

    /**
     * @param {int} x - x or id
     * @param {?int} z
     * @return {?Piece}
     */
    piece(x, z = null) {
        if (!z) return this.pieces.get(x)
        for (const [, piece] of this.pieces) {
            if (piece.z === z && piece.x === x) return piece;
        }
        return null
    }

    kill(piece) {
        if (!piece) return
        if (this.pieces.has(piece.id)) {
            piece.remove()
            this.pieces.delete(piece.id)
        }
    }

    /**
     * @param {number} x
     * @param {number} z
     */
    height(x, z) {
        return this.data[z][x]['h']
    }

    pieceData() {
        let data = []
        this.pieces.forEach((piece) => {
            data.push(piece.toData())
        })
        return data
    }

    /**
     * @param {string} url
     * @param {THREE.Object3D} root
     */
    load(url, root) {
        let img = new Image();
        img.onload = () => {
            let canvas = document.createElement('canvas');
            let ctx = canvas.getContext('2d');
            canvas.width = canvas.height = 64;
            ctx.drawImage(img, 0, 0, 64, 64);
            let imageData = ctx.getImageData(0, 0, 64, 64).data;
            for (let x = 0; x < 64; x++) {
                for (let z = 0; z < 64; z++) {
                    let index = (z * 64 + x) * 4;
                    let r = imageData[index];
                    let g = imageData[index + 1];
                    let b = imageData[index + 2];
                    let a = imageData[index + 3] / 16;
                    let height = Math.round(a);
                    let tile = new Tile(x, z, height, r, g, b, this, root)
                    if (!this.data[z]) this.data[z] = []
                    this.data[z][x] = tile;
                    this.tiles.push(tile)
                }
            }
            this.on_load()
        };
        img.src = url;
    }

    /**
     * @param {Piece} piece
     * @return {?Piece}
     */
    findNearestPiece(piece) {
        let nearest = null;
        let minDist = Infinity;
        const position = piece.object.position
        this.pieces.forEach((piece) => {
            let dist = piece.object.position.distanceTo(position);
            if (dist < minDist) {
                minDist = dist;
                nearest = piece;
            }
        })
        return nearest;
    }

    /**
     * @return {Set.<Tile>}
     */
    spawnable_tiles() {
        const myTiles = new Set();
        const enemyTiles = new Set();

        this.pieces.forEach(piece => {
            const tiles = piece.spawnable_tiles();
            if (piece.side === this.local_side) { // 我方棋子
                tiles.forEach(tile => myTiles.add(tile));
            } else { // 敌方棋子
                tiles.forEach(tile => enemyTiles.add(tile));
            }
        });

        // 计算仅属于单方的格子
        const result = new Set();
        myTiles.forEach(tile => {
            if (!enemyTiles.has(tile)) result.add(tile);
        });
        return result;
    }
}

const local_color = 0x5090ff;
const local_highlight_color = 0x00ff00;
const enemy_color = 0xdd3000;
const enemy_highlight_color = 0xffaa00;

export class Piece {
    /**
     * @typedef handler
     * @type {object}
     * @property {function} event
     */

    /** @type {handler} */
    event_handler = {}
    /** @type {THREE.Object3D}*/
    object
    /** @type {int}*/
    id
    /** @type {int}*/
    x
    /** @type {int}*/
    z
    /** @type {Board}*/
    map
    /** @type {string}*/
    side

    /**
     * @param {number} id
     * @param {string} side
     * @param {number} x
     * @param {number} z
     * @param {Board} map
     * @param {THREE.Object3D} root
     */
    constructor(id, side, x, z, map, root) {
        this.id = id
        this.side = side
        this.x = x;
        this.z = z;
        this.map = map;
        this.color = (side === map.local_side ? local_color : enemy_color)
        this.hcolor = (side === map.local_side ? local_highlight_color : enemy_highlight_color)
        this.gen_object(root)
        this.map.pieces.set(id, this)
    }

    /**
     * @return {int}
     */
    get y() {
        return this.map.height(this.x, this.z)
    }

    get type() {
        return 'piece'
    }

    /**
     * @param {actionData} event
     */
    handle_event(event) {
        this.event_handler[event.type](event);
    }

    toData() {
        return {id: this.id, x: this.x, z: this.z, type: this.type, side: this.side};
    }

    /**
     * @param {THREE.Object3D} root
     */
    gen_object(root) {
        let piece = new THREE.Group()
        this.object = piece;
        this.object.userData = this
        this.update_pos()
        root.add(piece);
    }

    remove() {
        this.object.parent.remove(this.object);
    }

    update_pos() {
        this.object.position.set(this.x, this.y / 2, this.z);
    }

    /**
     * @param {boolean} highlight
     */
    set_highlight(highlight) {
    }

    get_spawn_range() {
        return 2
    }

    get_view_range() {
        return 5;
    }

    /**
     * @return {Set.<Piece>}
     */
    pieceInView() {
        const visiblePieces = new Set();
        const viewRange = this.get_view_range();
        if (viewRange === 0) return visiblePieces; // 视野为 0，不需要检测

        this.map.pieces.forEach(piece => {
            if (piece.side === this.side) return; // 只检测敌方单位

            let dx = Math.abs(piece.x - this.x);
            let dz = Math.abs(piece.z - this.z);
            if (dx > viewRange || dz > viewRange) return; // 超出正方形范围

            if (canSee(this, piece)) {
                visiblePieces.add(piece);
            }
        });

        return visiblePieces;
    }


    /**
     * @return {Set.<Tile>}
     */
    spawnable_tiles() {
        const tiles = new Set();
        const range = this.get_spawn_range();

        for (let dx = -range; dx <= range; dx++) {
            for (let dz = -range; dz <= range; dz++) {
                const x = this.x + dx;
                const z = this.z + dz;

                // 边界检查
                if (x < 0 || x >= 64 || z < 0 || z >= 64) continue;
                tiles.add(this.map.tile(x, z));
            }
        }
        return tiles;
    }

    tick() {

    }
}

export class Flag extends Piece {
    static baseGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.2, 16);
    static poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 3, 8); // 旗杆
    static flagGeometry = new THREE.PlaneGeometry(0.7, 0.5); // 旗子

    gen_object(root) {
        super.gen_object(root)
        let baseMaterial = new THREE.MeshStandardMaterial({color: 0x808080});
        let base = new THREE.Mesh(Flag.baseGeometry, baseMaterial);
        base.position.y = 0.1
        this.object.add(base)
        // 旗杆
        let poleMaterial = new THREE.MeshStandardMaterial({color: 0xaaaaaa});
        let pole = new THREE.Mesh(Flag.poleGeometry, poleMaterial);
        pole.position.set(0, 1.5, 0);
        this.object.add(pole);

        // 旗子
        let flagMaterial = new THREE.MeshStandardMaterial({color: 0x808080, side: THREE.DoubleSide});
        this.flag = new THREE.Mesh(Flag.flagGeometry, flagMaterial);
        this.flag.position.set(0.45, 2.7, 0);
        this.object.add(this.flag);
        this.tick()
    }

    get_spawn_range() {
        return 4
    }

    tick() {
        let spawnTiles = this.spawnable_tiles();
        let side = '';
        for (let tile of spawnTiles) {
            let piece = this.map.piece(tile.x, tile.z);
            if (piece && piece instanceof Soldier) {
                if (side === '')
                    side = piece.side
                else if (side !== piece.side)
                    return
            }
        }
        if (side !== '' && side !== this.side) {
            if (this.side === "") this.side = side
            else this.side = ""
        }
        if (this.side === this.map.local_side) {
            this.flag.material.color.set(local_color); // 我方（蓝色）
        } else if (this.side !== "") {
            this.flag.material.color.set(enemy_color); // 敌方（红色）
        } else {
            this.flag.material.color.set(0x808080); // 争夺状态（灰色）
        }
    }

    get type() {
        return 'Flag'
    }
}

export class Soldier extends Piece {
    static baseGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 16);
    static roleGeometry = new THREE.PlaneGeometry(0.8, 1.6);

    /**@type {string}*/
    equip = ''
    waiting = 10
    bullet = 0

    /**
     * @param {number} id
     * @param {string} side
     * @param {number} x
     * @param {number} z
     * @param {Board} map
     * @param {THREE.Object3D} root
     */
    constructor(id, side, x, z, map, root) {
        super(id, side, x, z, map, root);
        this.event_handler['move'] = (event) => this.moveEvent(event)
        this.event_handler['shot'] = (event) => this.shotEvent(event)
    }

    get type() {
        return 'solider'
    }

    toData() {
        return {
            ...super.toData(),
            equip: this.equip,
            waiting: this.waiting,
            bullet: this.bullet
        };
    }

    spawnable_tiles() {
        if (this.waiting === 10) return new Set()
        return super.spawnable_tiles();
    }

    getBullet() {
        return 1;
    }

    get_view_range() {
        return this.bullet > 0 ? super.get_view_range() : 0;
    }

    tick() {
        if (this.waiting === 10) this.waiting = 0
        if (this.waiting > 0) this.waiting--
        if (this.waiting === 0) this.bullet = this.getBullet()
    }

    get_img_url() {
        return 'img/Soldier.png'
    }

    gen_object(root) {
        super.gen_object(root);
        let baseMaterial = new THREE.MeshStandardMaterial({color: this.color});
        let base = new THREE.Mesh(Soldier.baseGeometry, baseMaterial);
        base.position.y = 0.1

        let roleMaterial = new THREE.MeshStandardMaterial({
            map: new THREE.TextureLoader().load(this.get_img_url()), transparent: true, side: THREE.DoubleSide
        });
        let role = new THREE.Mesh(Soldier.roleGeometry, roleMaterial);
        role.position.y = 1
        role.rotateY(-Math.PI / 2)

        this.object.add(base)
        this.object.add(role)

        let nearestPiece = this.map.findNearestPiece(this);
        if (nearestPiece) {
            this.object.lookAt(nearestPiece.x, this.object.position.y, nearestPiece.z);
        }
    }

    moveEvent(event) {
        this.object.lookAt(event.x, this.y / 2, event.z);
        this.x = event.x;
        this.z = event.z;
        this.update_pos()
        this.waiting = 1
    }

    shotEvent(event) {
        this.object.lookAt(event.x, this.y / 2, event.z);
        let enemy = this.map.piece(event.x, event.z);
        this.map.kill(enemy)
        this.bullet--;
        this.waiting = 1
    }

    set_highlight(highlight) {
        this.object.children[0].material.color.set(highlight ? this.hcolor : this.color);
    }

    /**
     * @return {int}
     */
    get_strength() {
        return 1
    }

    /**
     * @return {Set.<Tile>}
     */
    moveable_tiles() {

        const tiles = new Set();
        if (this.waiting > 0) return tiles
        let strength = this.get_strength();
        let queue = [{x: this.x, z: this.z, strength: strength}];
        let visited = new Set();

        while (queue.length > 0) {
            let {x, z, strength} = queue.shift();

            let tile = this.map.tile(x, z);
            tiles.add(tile);

            for (let [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
                let nx = x + dx, nz = z + dz;
                if (nx < 0 || nx >= 64 || nz < 0 || nz >= 64) continue;

                let nextTile = this.map.tile(nx, nz);
                let heightDiff = nextTile.h - tile.h;
                if (Math.abs(heightDiff) > 3) continue
                let nextStrength = strength - 1 - Math.max(0, heightDiff - 1);
                if (nextStrength < 0) continue;
                if (!visited.has(nextTile)) {
                    queue.push({x: nx, z: nz, strength: nextStrength});
                    visited.add(nextTile)
                }
            }
        }

        for (let piece of this.map.pieces.values()) {
            tiles.delete(this.map.tile(piece.x, piece.z));
        }

        return tiles;
    }

}

export class Assault extends Soldier {
    get type() {
        return 'Assault'
    }

    get_img_url() {
        if (this.equip === 'WingSuit')
            return 'img/soldier/assault_wingsuit.png';
        return 'img/soldier/assault.png';
    }

    getBullet() {
        return 5
    }

    get_strength() {
        return 2
    }

    moveable_tiles() {
        if (this.equip !== 'WingSuit')
            return super.moveable_tiles();
        const tiles = new Set();
        let maxRange = 16;
        let baseStrength = this.get_strength();
        let queue = [{x: this.x, z: this.z, strength: baseStrength}];
        let visited = new Set();

        while (queue.length > 0) {
            let {x, z, strength} = queue.shift();
            let tile = this.map.tile(x, z);
            tiles.add(tile);
            if (strength === 0) continue

            for (let [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
                let nx = x + dx, nz = z + dz;
                if (nx < 0 || nx >= 64 || nz < 0 || nz >= 64) continue;
                if (Math.abs(nx - this.x) > maxRange || Math.abs(nz - this.z) > maxRange) continue;

                let nextTile = this.map.tile(nx, nz);
                let heightDiff = nextTile.h - tile.h;
                if (heightDiff > 0) heightDiff -= 1
                let nextStrength = strength - 1 - heightDiff;
                if (nextStrength < 0) continue;

                if (!visited.has(nextTile)) {
                    queue.push({x: nx, z: nz, strength: nextStrength});
                    visited.add(nextTile);
                }
            }
        }

        for (let piece of this.map.pieces.values()) {
            tiles.delete(this.map.tile(piece.x, piece.z));
        }
        return tiles;


    }
}

export class Engineer extends Soldier {
    get type() {
        return 'Engineer'
    }

    shotEvent(event) {
        for (let i = event.x - 1; i <= event.x + 1; i++) {
            for (let j = event.z - 1; j <= event.z + 1; j++) {
                let enemy = this.map.piece(i, j);
                if (enemy)
                    this.map.kill(enemy)
            }
        }
        this.bullet--;
        this.waiting = 1
    }

    get_img_url() {
        return 'img/soldier/engineer.png';
    }
}

export class Sniper extends Soldier {
    get type() {
        return 'Sniper'
    }

    get_view_range() {
        return 12
    }

    get_img_url() {
        return 'img/soldier/sniper.png';
    }
}