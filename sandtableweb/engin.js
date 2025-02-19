import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {onBackgroundClick, onPieceClick, onTileClick} from "./main.js";
import {Soldier, Piece} from "./model.js";


const yellowEmissive = new THREE.Color(0x888800)
const greenEmissive = new THREE.Color(0x008800)
const defaultEmissive = new THREE.Color(0)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true});
const controls = new OrbitControls(camera, renderer.domElement);

const board = new THREE.Group();
const pieces = new THREE.Group();

const raycaster = new THREE.Raycaster();
/** @type {Set.<Mesh>}*/
const highlight_tiles = new Set();
const mouse = new THREE.Vector2();
/** @type {?Mesh}*/
let hover_tile = null;
let mouseMoved = false;

export function enginInit() {
    camera.position.set(32, 50, 100);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('container').appendChild(renderer.domElement);
    controls.enableDamping = true;

    let light = new THREE.DirectionalLight(0xffffff, 1);
    light.position.set(30, 70, 50).normalize();
    scene.add(light);
    let ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    scene.add(board);
    scene.add(pieces);
}

export function enginStart() {
    animate();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    hoverTile();
    renderer.render(scene, camera);
}

/**
 * @param {MouseEvent} event
 */
function onMouseMove(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    hoverTile();
    mouseMoved = true;
}

function onMouseDown() {
    mouseMoved = false;
}

/**
 * @param {MouseEvent} event
 */
function onMouseUp(event) {
    if (event.target !== renderer.domElement) return;
    if (mouseMoved) return
    raycaster.setFromCamera(mouse, camera);
    let intersects = raycaster.intersectObjects(pieces.children);
    if (intersects.length !== 0) {
        /**@type {?Soldier}*/
        let solider = null
        for (let i = 0; i < intersects.length; i++) {
            if (intersects[i].object.parent.userData instanceof Soldier) {
                solider = intersects[i].object.parent.userData
                break
            }
        }
        if (solider) {
            onPieceClick(solider)
            return;
        }
    }

    intersects = raycaster.intersectObjects(board.children);
    if (intersects.length !== 0) {
        /**@type {Mesh}*/
        let tile = intersects[0].object;
        /**@type {Tile}*/
        let tileData = tile.userData
        onTileClick(tileData)
        return;
    }
    onBackgroundClick()
}

/**
 * 检测棋子 A 是否能看到棋子 B
 * @param {Piece} piece_a
 * @param {Piece} piece_b
 * @return {boolean} 如果没有遮挡，则返回 true
 */
export function canSee(piece_a, piece_b) {
    let start = new THREE.Vector3(piece_a.x, piece_a.y / 2 + 0.8, piece_a.z); // A 头部
    let end = new THREE.Vector3(piece_b.x, piece_b.y / 2 + 0.8, piece_b.z); // B 头部

    let direction = new THREE.Vector3().subVectors(end, start).normalize();
    let distance = start.distanceTo(end);

    raycaster.set(start, direction);
    // **检测地形遮挡**
    let terrainIntersects = raycaster.intersectObjects(board.children);

    for (let intersect of terrainIntersects) {
        if (intersect.distance < distance) {
            return false; // **被地形遮挡**
        }
    }
    // **检测棋子遮挡**
    let pieceIntersects = raycaster.intersectObjects(pieces.children);

    for (let intersect of pieceIntersects) {
        if (intersect.distance > 0.4 && intersect.distance < distance - 0.4) {
            return false; // **被棋子遮挡**
        }
    }


    return true; // **无障碍物**
}


function hoverTile() {
    raycaster.setFromCamera(mouse, camera);
    let intersects = raycaster.intersectObjects(board.children);

    if (hover_tile) {
        if (highlight_tiles.has(hover_tile)) hover_tile.material.emissive = greenEmissive; else hover_tile.material.emissive = defaultEmissive;
        hover_tile = null;
    }

    if (intersects.length > 0) {
        hover_tile = intersects[0].object;
        hover_tile.material.emissive = yellowEmissive
    }
}

/**
 * @param {Set.<Tile>} tiles
 */
export function highlightTile(tiles) {
    resetTile()
    tiles.forEach(tile => {
        highlight_tiles.add(tile.object);
        tile.object.material.emissive = greenEmissive;
    });
}

function resetTile() {
    highlight_tiles.forEach(tile => {
        tile.material.emissive = defaultEmissive
    })
    highlight_tiles.clear();
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

export function getBoard() {
    return board
}

export function getPieces() {
    return pieces
}