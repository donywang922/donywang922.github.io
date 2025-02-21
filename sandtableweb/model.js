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
    /** @type {int} */
    x_size
    /** @type {int} */
    z_size
    /** @type {int} */
    force_a = 0
    /** @type {int} */
    force_b = 0
    /** @type {int[]} */
    card_a = []
    /** @type {int[]} */
    card_b = []

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

    /**
     * @param {Piece} piece
     */
    kill(piece) {
        if (!piece) return;
        if (!this.pieces.has(piece.id)) return;
        piece.remove();
        this.pieces.delete(piece.id);
        // 获取棋子所属阵营
        const pieceSide = piece.side;
        const isLocalSide = (pieceSide === this.local_side);

        if (!piece instanceof Soldier) {
            // **如果不是 Soldier 类型**
            if (isLocalSide)
                this.force_a--;
            else
                this.force_b--;
            return;
        }
        // **如果是 Soldier 类型**
        // 获取旗帜数量
        const localFlags = Array.from(this.pieces.values()).filter(p => p instanceof Flag && p.side === this.local_side).length;
        const enemyFlags = Array.from(this.pieces.values()).filter(p => p instanceof Flag && p.side !== this.local_side).length;

        if ((isLocalSide && localFlags < enemyFlags) || (!isLocalSide && enemyFlags < localFlags)) {
            // **旗帜数量少的一方**
            const flagDiff = Math.abs(localFlags - enemyFlags);
            const loss = 1 + Math.pow(flagDiff, 2);
            if (isLocalSide) {
                this.force_a -= loss;
            } else {
                this.force_b -= loss;
            }
            return;
        }
        // **旗帜数量相等或更多的一方**
        if (isLocalSide) {
            this.force_a--;
        } else {
            this.force_b--;
        }
    }


    /**
     * @param {number} x
     * @param {number} z
     */
    height(x, z) {
        return this.tile(x, z).h
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
            this.x_size = canvas.width = img.width;
            this.z_size = canvas.height = img.height;
            ctx.drawImage(img, 0, 0, img.width, img.height);

            let imageData = ctx.getImageData(0, 0, img.width, img.height).data;

            // 根据图片实际大小初始化棋盘
            this.data = [];
            this.tiles = [];

            for (let x = 0; x < img.width; x++) {
                for (let z = 0; z < img.height; z++) {
                    let index = (z * img.width + x) * 4;
                    let r = imageData[index];
                    let g = imageData[index + 1];
                    let b = imageData[index + 2];
                    let a = imageData[index + 3] / 16;
                    let height = Math.round(a);

                    let tile = new Tile(x, z, height, r, g, b, this, root);
                    if (!this.data[z]) this.data[z] = [];
                    this.data[z][x] = tile;
                    this.tiles.push(tile);
                }
            }

            this.on_load();
        };
        img.src = url;
    }

    inRange(x, z) {
        return x >= 0 && x < this.x_size && z >= 0 && z < this.z_size
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
    pieceInView(sameSide = false) {
        const visiblePieces = new Set();
        const viewRange = this.get_view_range();
        if (viewRange === 0) return visiblePieces; // 视野为 0，不需要检测

        this.map.pieces.forEach(piece => {
            if (!sameSide && piece.side === this.side) return; // 只检测敌方单位

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
                if (!this.map.inRange(x, z)) continue;
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

    constructor(id, side, x, z, map, root) {
        super(id, side, x, z, map, root);
        this.event_handler['occupy'] = (event) => this.occupyEvent(event)
    }

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
        this.updateColor()
    }

    get_spawn_range() {
        return 4
    }

    get_view_range() {
        return 2
    }

    /**
     * @param {actionData} event
     */
    occupyEvent(event) {
        this.side = event.side;
        this.updateColor()
    }

    tick() {
        const piecesIn = this.pieceInView(true)
        let side = '';
        for (let piece of piecesIn) {
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
        this.updateColor()
    }

    updateColor() {
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

    /**
     * @param {actionData} event
     */
    moveEvent(event) {
        this.object.lookAt(event.x, this.y / 2, event.z);
        this.x = event.x;
        this.z = event.z;
        this.update_pos()
        this.waiting = 1
        this.bullet = 0
    }

    /**
     * @param {actionData} event
     */
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
        return 2
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
                if (!this.map.inRange(nx, nz)) continue;

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
        return 3
    }

    get_strength() {
        return 4
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
                if (!this.map.inRange(nx, nz)) continue;
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
        this.object.lookAt(event.x, this.y / 2, event.z);
        for (let i = event.x - 1; i <= event.x + 1; i++) {
            for (let j = event.z - 1; j <= event.z + 1; j++) {
                let enemy = this.map.piece(i, j);
                if (enemy && enemy instanceof Soldier)
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
        return this.bullet > 0 ? 8 : 0;
    }


    get_strength() {
        return 1
    }

    get_img_url() {
        return 'img/soldier/sniper.png';
    }
}