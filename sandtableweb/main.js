import {Piece, Soldier, Assault, Board, Tile, Engineer, Flag, Sniper, Tank} from "./model.js";
import {getData, getName, getRoom, send} from "./connection.js";
import {enginInit, enginStart, getBoard, getDirection, getPieces, highlightTile} from "./engin.js";


/**@type {Board}*/
let map

export function onConnected() {
    enginInit()
    const data = getData();
    const localName = getName();
    map = new Board(`img/map/${data.map}.png`, getBoard(), localName, onBoardLoad)
    const isUser1 = data.user1 === localName
    map.force_a = isUser1 ? data.user1force : data.user2force
    map.force_b = isUser1 ? data.user2force : data.user1force
    map.card_a = isUser1 ? data.user1card : data.user2card
    map.card_b = isUser1 ? data.user2card : data.user1card
    updateUI()
}

function updateNumericUI() {
    const data = getData();
    const localName = getName();
    // 确定对手名称
    const enemyName = data.user1 === localName ? data.user2 : data.user1;
    document.querySelector('.info h3').innerText = enemyName || "Waiting...";
    // 更新 force (兵力数值)
    document.querySelector('.force span.l').innerText = map.force_a
    document.querySelector('.force span.r').innerText = map.force_b;

    let total_force = 128 / 100

    // 更新 force 进度条
    document.querySelector('.force div.l').style.setProperty('--f', map.force_a / total_force);
    document.querySelector('.force div.r').style.setProperty('--f', map.force_b / total_force);
    // 更新敌方卡片数量
    document.querySelector('.enemy_card h1').innerText = map.card_b.length;
    updatePlaceCount()
}

function updateCardUI() {
    // 更新卡牌区 (清空后重新添加)
    const cardContainer = document.querySelector('.card');
    cardContainer.innerHTML = "";
    const userCards = map.card_a;

    userCards.forEach(card_id => {
        const card = getData().cards[card_id]
        const cardElement = document.createElement('div');
        cardElement.draggable = true;
        cardElement.innerHTML = `
            <img src="${card.img}.png" alt="">
            <div>
                <h3>${card.name}</h3>
                <p>${card.desc}</p>
            </div>
        `;
        cardElement.addEventListener('dragstart', (event) => {
            event.dataTransfer.setData("text", card.name);
        });
        cardContainer.appendChild(cardElement);
    });
}

function updateUI() {
    const data = getData();
    const localName = getName();

    // 更新 action 面板中的玩家名称
    document.querySelector('.action h3').innerText = localName;

    // 确定对手名称
    const enemyName = data.user1 === localName ? data.user2 : data.user1;
    document.querySelector('.info h3').innerText = enemyName || "Waiting...";
    document.querySelector('.info h2').innerText = `#${getRoom()}`;

    updateNumericUI()
    updateCardUI()

    if (data.turn !== getName()) {
        setAction('waiting')
    }
}

function onBoardLoad() {
    forceRefresh();

    let mySide = getName(); // 我方名称
    let flagPieces = Array.from(map.pieces.values()).filter(piece => piece instanceof Flag); // 只获取旗子
    let myFlags = flagPieces.filter(flag => flag.side === mySide); // 统计我方旗子

    if (flagPieces.length === 0) {
        let counter = 1
        for (let tile of map.tiles) {
            if (tile.r === 128 && tile.g === 128) {
                let side = ''
                if (tile.b === 129) {
                    side = mySide
                } else if (tile.b === 130) {
                    side = 'user2'
                }
                getData().actions.push({
                    id: 0,
                    type: 'place',
                    x: tile.x,
                    z: tile.z,
                    soldier: 'Flag',
                    soldier_id: counter,
                    side: side
                });
                counter++
            }
        }
        onUpdate();
        send();
    } else if (myFlags.length === 0) {
        for (let flag of flagPieces) {
            if (flag.side === 'user2') {
                getData().actions.push({
                    id: flag.id,
                    type: 'occupy',
                    side: getName()
                });
                onUpdate()
                send();
            }
        }
    }
    enginStart();
}


let action_index = 0

/**
 * @param {roomData} data
 */
export function onUpdate(data = getData()) {
    if (data.actions.length === 0 && action_index !== 0) {
        forceRefresh()
        tick()
    }
    while (data.actions.length > action_index) {
        action_index++
        onAction(data.actions[action_index - 1]);
    }
}

/**
 * @param {actionData} action
 */
function onAction(action) {
    if (action.id === 0) {
        switch (action.type) {
            case 'end_turn':
                if (action.side === getName()) return;
                const data = getData();
                const localName = getName();
                const isUser1 = data.user1 === localName
                data.actions = []
                data.turn = localName
                tick()
                data.pieces = map.pieceData()
                data.user1force = isUser1 ? map.force_a : map.force_b
                data.user2force = isUser1 ? map.force_b : map.force_a
                data.user1card = isUser1 ? map.card_a : map.card_b
                data.user2card = isUser1 ? map.card_b : map.card_a
                action_index = 0
                send()
                setAction('end_turn')
                return;
            case 'place':
                let piece = placePiece(action.soldier, action.soldier_id, action.side, action.x, action.z)
                if (piece instanceof Tank)
                    piece.direction = action.direction
                return;
        }
    }
    map.piece(action.id).handle_event(action)
    updateNumericUI()
}

function forceRefresh() {
    let data = getData()
    console.log(data)
    let tmp_set = new Set()
    for (let piece of data.pieces) {
        let tmp = map.piece(piece.id)
        tmp_set.add(piece.id)
        if (!tmp) {
            tmp = placePiece(piece.type, piece.id, piece.side, piece.x, piece.z)
        } else {
            tmp.x = piece.x
            tmp.z = piece.z
            tmp.side = piece.side
        }
        tmp.waiting = piece.waiting
        if (piece.hasOwnProperty("equip")) tmp.equip = piece.equip
        if (piece.hasOwnProperty("bullet")) tmp.bullet = piece.bullet
        if (piece.hasOwnProperty("health")) tmp.health = piece.health
        if (piece.hasOwnProperty("direction")) tmp.direction = piece.direction
    }
    for (let [id, piece] of map.pieces) {
        if (!tmp_set.has(id)) piece.remove()
    }
    updateUI()
    action_index = 0
    onUpdate()
}


/**
 * @param {string} type
 * @param {int} id
 * @param {string} side
 * @param {int} x
 * @param {int} z
 * @return {Piece}
 */
function placePiece(type, id, side, x, z) {
    let piece;
    switch (type) {
        case 'Assault':
            piece = new Assault(id, side, x, z, map, getPieces());
            break;
        case 'Engineer':
            piece = new Engineer(id, side, x, z, map, getPieces());
            break;
        case 'Sniper':
            piece = new Sniper(id, side, x, z, map, getPieces());
            break;
        case 'Flag':
            piece = new Flag(id, side, x, z, map, getPieces());
            break;
        case 'Tank':
            piece = new Tank(id, side, x, z, map, getPieces());
            break;
    }

    // 更新 .action .place 中 span 的文本
    updatePlaceCount()
    return piece;
}

const total_pt = 56

function updatePlaceCount() {
    const [assaultCount, engineerCount, sniperCount, tankCount] = countSoldier()
    document.querySelector('[data-soldier="Assault"] span').innerText = `${assaultCount} * 1pt`;
    document.querySelector('[data-soldier="Engineer"] span').innerText = `${engineerCount} * 2pt`;
    document.querySelector('[data-soldier="Sniper"] span').innerText = `${sniperCount} * 4pt`;
    document.querySelector('[data-soldier="Tank"] span').innerText = `${tankCount} * 8pt`;
    let pt = assaultCount + engineerCount * 2 + sniperCount * 3 + tankCount * 8
    document.querySelector('.place>.total').innerText = `${pt} / ${total_pt} pt`;
}

function countSoldier() {
    const assaultCount = Array.from(map.pieces.values()).filter(p => (p.side === getName() && p instanceof Assault)).length;
    const engineerCount = Array.from(map.pieces.values()).filter(p => (p.side === getName() && p instanceof Engineer)).length;
    const sniperCount = Array.from(map.pieces.values()).filter(p => (p.side === getName() && p instanceof Sniper)).length;
    const tankCount = Array.from(map.pieces.values()).filter(p => (p.side === getName() && p instanceof Tank)).length;
    return [assaultCount, engineerCount, sniperCount, tankCount]
}


function canPlace() {
    const [assaultCount, engineerCount, sniperCount, tankCount] = countSoldier()
    let pt = assaultCount + engineerCount * 2 + sniperCount * 3 + tankCount * 8
    switch (current_soldier_type) {
        case 'Assault':
            return pt + 1 <= 56;
        case 'Engineer':
            return pt + 2 <= 56;
        case 'Sniper':
            return pt + 4 <= 56;
        case 'Tank':
            return pt + 8 <= 56;
    }
    return false;
}

function tick() {
    map.pieces.forEach(piece => {
        piece.tick()
    })
}

/**@type {Set.<Soldier>}*/
let selected_pieces = new Set();
/** @type {Set.<Tile>}*/
const highlighted_tiles = new Set();
/** @type {Set.<Piece>}*/
const highlighted_enemy = new Set();

/**
 * @param {Tile} tile
 */
export function onTileClick(tile) {
    if (current_action === 'waiting') return;
    let piece = map.piece(tile.x, tile.z)
    if (piece) {
        if (piece instanceof Soldier) {
            onPieceClick(piece)
        }
        return
    }
    if (current_action === 'place') {
        if (!highlighted_tiles.has(tile)) {
            highlighted_tiles.clear()
            highlightTile(highlighted_tiles)
            setAction('end_turn')
            return;
        }
        if (current_soldier_type === '') return;
        if (!canPlace()) return;
        if (current_soldier_type === 'Tank') {
            if (!Tank.canPlaceTank(tile.x, tile.z, map)) return;
            getData().actions.push({
                id: 0,
                type: 'place',
                x: tile.x,
                z: tile.z,
                soldier: current_soldier_type,
                soldier_id: Date.now(),
                side: getName(),
                direction: getDirection()
            })
        } else {
            getData().actions.push({
                id: 0,
                type: 'place',
                x: tile.x,
                z: tile.z,
                soldier: current_soldier_type,
                soldier_id: Date.now(),
                side: getName()
            })
        }
        onUpdate()
        send()
        return;
    }
    if (highlighted_tiles.has(tile)) {
        let tmp = selected_pieces.values().next().value;
        getData().actions.push({
            id: tmp.id,
            type: 'move',
            x: tile.x,
            z: tile.z,
        })
        onUpdate()
        send()
        deselectPiece(tmp)
        setAction('end_turn')
        return;
    }
    if (selected_pieces.size > 1) {
        let tmp_tiles = new Set()
        selected_pieces.forEach(piece => {
            let moveable_tiles = piece.moveable_tiles()
            tmp_tiles.forEach(tile => {
                moveable_tiles.delete(tile)
            })
            let nearestTile = findNearestTile(tile, moveable_tiles);
            if (nearestTile) {
                tmp_tiles.add(nearestTile)
                getData().actions.push({
                    id: piece.id,
                    type: 'move',
                    x: nearestTile.x,
                    z: nearestTile.z,
                });
            }
        });

        onUpdate();
        send();
        selected_pieces.forEach(piece => {
            piece.set_highlight(false)
        });
        selected_pieces.clear()
        highlighted_tiles.clear()
        highlightTile(highlighted_tiles)
        setAction('end_turn');
        return;
    }
    if (selected_pieces.size === 1) {
        let tmp = selected_pieces.values().next().value;
        deselectPiece(tmp)
    }
    if (current_soldier_type === 'Tank')
        addAllTileToHighlight(map.spawnable_tiles(true))
    else
        addAllTileToHighlight(map.spawnable_tiles())
    highlightTile(highlighted_tiles)
    setAction('place')
}

/**
 * @param {Soldier} piece
 */
export function onPieceClick(piece) {
    if (current_action === 'waiting') return;
    highlighted_tiles.clear()
    if (highlighted_enemy.has(piece)) {
        /**@type {Soldier}*/
        let tmp = selected_pieces.values().next().value;
        if (piece.side === tmp.side && piece instanceof Tank && tmp instanceof Engineer) {
            getData().actions.push({
                id: tmp.id,
                type: 'repair',
                x: piece.x,
                z: piece.z,
            });
        } else {
            getData().actions.push({
                id: tmp.id,
                type: 'shot',
                x: piece.x,
                z: piece.z,
            });
        }
        onUpdate();
        send();
        highlighted_tiles.clear()
        highlightTile(highlighted_tiles)
        deselectPiece(tmp)
        if (tmp.bullet <= 0) {
            setAction('end_turn')
        } else {
            selectPiece(tmp)
        }
        return;
    }

    highlighted_enemy.forEach(enemy => {
        enemy.set_highlight(false)
    })
    highlighted_enemy.clear()
    if (selected_pieces.has(piece)) deselectPiece(piece)
    else if (piece.side === getName()) selectPiece(piece)
}

export function onBackgroundClick() {
    if (current_action === 'waiting') return;

    highlighted_tiles.clear()
    highlightTile(highlighted_tiles)
    selected_pieces.forEach(piece => {
        piece.set_highlight(false)
    })
    selected_pieces.clear()
    highlighted_tiles.clear()
    highlighted_enemy.forEach(enemy => {
        enemy.set_highlight(false)
    })

    setAction('end_turn')
}

/**
 * @param {Tile} target
 * @param {Set.<Tile>} moveableTiles
 * @return {?Tile}
 */
function findNearestTile(target, moveableTiles) {
    let nearestTile = null;
    let minDist = Infinity;

    moveableTiles.forEach(tile => {
        let dist = Math.abs(tile.x - target.x) + Math.abs(tile.z - target.z); // 曼哈顿距离
        if (dist < minDist) {
            minDist = dist;
            nearestTile = tile;
        }
    });

    return nearestTile;
}

/**
 * @param {Soldier} piece
 */
function selectPiece(piece) {
    selected_pieces.add(piece)
    piece.set_highlight(true)
    if (selected_pieces.size === 1) {
        addAllTileToHighlight(piece.moveable_tiles())
        addAllEnemyToHighlight(piece.pieceInView())
        updateSoldierCard(piece)
        setAction('soldier')
    } else if (selected_pieces.size > 1) {
        setAction('batch')
    }
    highlightTile(highlighted_tiles)
}

/**
 * @param {Soldier} piece
 */
function deselectPiece(piece) {
    if (!selected_pieces.has(piece)) return
    selected_pieces.delete(piece)
    piece.set_highlight(false)
    if (selected_pieces.size === 1) {
        let tmp = selected_pieces.values().next().value;
        addAllTileToHighlight(tmp.moveable_tiles())
        addAllEnemyToHighlight(tmp.pieceInView())
        updateSoldierCard(tmp)
        setAction('soldier')
    } else if (selected_pieces.size === 0) {
        highlighted_tiles.clear()
        highlighted_enemy.forEach(enemy => {
            enemy.set_highlight(false)
        })
        highlighted_enemy.clear()
        setAction('end_turn')
    }
    highlightTile(highlighted_tiles)
}


function addAllTileToHighlight(tiles) {
    tiles.forEach(tile => {
        highlighted_tiles.add(tile)
    })
}

/**
 * @param {Set.<Piece>} enemies
 */
function addAllEnemyToHighlight(enemies) {
    enemies.forEach(enemy => {
        enemy.set_highlight(true)
        highlighted_enemy.add(enemy)
    })
}

const action_menu = document.querySelector('.action')
let current_action = 'end_turn'

/**
 * @param {string} action
 */
export function setAction(action) {
    action_menu.classList.remove(current_action);
    action_menu.classList.add(action);
    current_action = action
}

function endTurn() {
    getData().actions.push({
        id: 0,
        type: 'end_turn',
        side: getName()
    })
    send()
    setAction('waiting')
}

action_menu.querySelector('.end_turn button').addEventListener('click', () => {
    endTurn()
})

const choices = action_menu.querySelectorAll('.place>div');

let current_soldier_type = ''

function selectSoldierType(card) {
    if (card.classList.contains('select')) {
        card.classList.remove('select');
        current_soldier_type = null
        return
    }
    choices.forEach(choice => {
        choice.classList.remove('select')
    })
    card.classList.add('select')
    current_soldier_type = card.dataset['soldier']
    highlighted_tiles.clear()
    if (current_soldier_type === 'Tank')
        addAllTileToHighlight(map.spawnable_tiles(true))
    else
        addAllTileToHighlight(map.spawnable_tiles())
    highlightTile(highlighted_tiles)
}

choices.forEach(choice => {
    choice.addEventListener('click', () => selectSoldierType(choice));
})


const soldier_info_img = action_menu.querySelector('.soldier img')
const soldier_info_type = action_menu.querySelector('.soldier .type')
const soldier_info_equip = action_menu.querySelector('.soldier .equip')
const soldier_info_location = action_menu.querySelector('.soldier .location')

function updateSoldierCard(piece) {
    soldier_info_img.src = piece.get_img_url()
    soldier_info_type.innerHTML = piece.type
    soldier_info_equip.innerHTML = piece.equip
    soldier_info_location.innerHTML = `X: ${piece.x} Z: ${piece.z} Y: ${piece.y}`;
}




