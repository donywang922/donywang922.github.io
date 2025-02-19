import {initializeApp} from "firebase/app";
import {getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot} from "firebase/firestore";
import {onConnected, onUpdate} from "./main.js";

/**
 * @typedef pieceData
 * @type {Object}
 * @property {int} id
 * @property {int} x
 * @property {int} z
 * @property {string} type
 * @property {string} side
 * @property {?string} [equip]
 * @property {int} [waiting]
 * @property {int} [bullet]
 */

/**
 * @typedef actionData
 * @type {Object}
 * @property {int} id
 * @property {string} type
 * @property {string} [side]
 * @property {int} [x]
 * @property {int} [z]
 * @property {string} [soldier]
 * @property {int} [soldier_id]
 */

/**
 * @typedef cardData
 * @type {Object}
 * @property {string} name
 * @property {string} img
 * @property {string} desc
 */

/** @typedef roomData
 * @type {Object}
 * @property {DateConstructor} time
 * @property {string} user1
 * @property {string} user2
 * @property {string} map
 * @property {Array.<pieceData>} pieces
 * @property {Array.<actionData>} actions
 * @property {string} turn
 * @property {int} user1force
 * @property {int} user2force
 * @property {Array.<int>} user1card
 * @property {Array.<int>} user2card
 * @property {Array.<cardData>} cards
 * @property {string} state
 */

const firebaseConfig = {
    apiKey: "AIzaSyCXQnBwpo7_lEFHxoSHfe4hDHwrktp9-rU",
    authDomain: "iat210.firebaseapp.com",
    projectId: "iat210",
    storageBucket: "iat210.firebasestorage.app",
    messagingSenderId: "282613477096",
    appId: "1:282613477096:web:bf80fdcb0679cd9f69635d",
    measurementId: "G-HV1P71XW4M"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const room_id = localStorage.getItem("roomId")
const local_name = localStorage.getItem("userName")

/**@type {roomData}*/
let local_data

export function connect() {
    if (!room_id || !local_name) {
        window.location.href = "index.html"; // 如果数据为空，返回主页
        return;
    }

    const roomRef = doc(db, "rooms", room_id);

    // 获取数据并调用 forceRefresh
    getDoc(roomRef).then((docSnap) => {
        if (docSnap.exists()) {
            local_data = docSnap.data()
            onConnected()
        } else {
            alert("Room not found! Redirecting...");
            window.location.href = "index.html";
        }
    });

    // 监听数据变化，调用 onAction 处理更新
    onSnapshot(roomRef, docSnap => {
        if (docSnap.exists()) {
            update(docSnap.data())
        }
    });
}


/**
 * @param {roomData} data
 */
function update(data) {
    if (JSON.stringify(local_data) === JSON.stringify(data)) {
        return;
    }
    local_data = data
    onUpdate(data)
}

export function getData() {
    return local_data
}

export function getName() {
    return local_name
}

export function getRoom() {
    return room_id
}

export function send() {
    let roomRef = doc(db, "rooms", room_id);
    updateDoc(roomRef, local_data)
}

connect()