const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const weaponText = document.getElementById("weapon");
const ammoText = document.getElementById("ammo");
const hint = document.getElementById("hint");

const stoveFill = document.getElementById("stoveFill");

const cameraScreen = document.getElementById("cameraScreen");
const cameraText = document.getElementById("cameraText");
const closeCameras = document.getElementById("closeCameras");

let W = 0;
let H = 0;

function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
}

window.addEventListener("resize", resize);
resize();

/* =========================
   ИГРОК
========================= */

const player = {
    x: 0,
    y: 0,
    angle: 0,

    // вертикальный обзор
    pitch: 0,

    speed: 2.4,

    weapon: null,
    ammo: 2,

    shooting: false
};

/*
    Карта:

    # = стена
    D = дверь
    C = камера
    T = стол/компьютер
    S = дробовик
    F = печка
    . = свободное место
*/

const map = [
    "########################",
    "#......................#",
    "#......................#",
    "#......................#",
    "#......................#",
    "#..........####........#",
    "#..........#..#........#",
    "#..........#..#........#",
    "#......................#",
    "#......................#",
    "#......................#",
    "#......................#",
    "#...............D......#",
    "#......................#",
    "#......................#",
    "##########......########",
    "##########......########",
    "##########......########",
    "##########......########",
    "##########......########",
    "##########......########",
    "##########..F...########",
    "########################"
];

const objects = [
    {
        type: "camera",
        x: 2.5,
        y: 7.5,
        name: "Камера со вспышкой",
        used: false
    },

    {
        type: "computer",
        x: 9.5,
        y: 10.5,
        name: "Компьютер"
    },

    {
        type: "shotgun",
        x: 11.2,
        y: 10.5,
        name: "Дробовик"
    },

    {
        type: "stove",
        x: 12.5,
        y: 21,
        name: "Печка"
    }
];

/* =========================
   УПРАВЛЕНИЕ
========================= */

const keys = {};

window.addEventListener("keydown", e => {
    keys[e.key.toLowerCase()] = true;

    if (e.key.toLowerCase() === "e") {
        interact();
    }

    if (e.key.toLowerCase() === "f") {
        shoot();
    }

    if (e.key === "Escape") {
        closeCameraSystem();
    }
});

window.addEventListener("keyup", e => {
    keys[e.key.toLowerCase()] = false;
});

/* Мышь */

let mouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;

canvas.addEventListener("mousedown", e => {
    mouseDown = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});

window.addEventListener("mouseup", () => {
    mouseDown = false;
});

window.addEventListener("mousemove", e => {
    if (!mouseDown || cameraScreen.style.display === "block") return;

    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    player.angle += dx * 0.004;

    player.pitch += dy * 0.7;

    player.pitch = Math.max(-120, Math.min(120, player.pitch));
});

/* Сенсор */

let touchX = 0;
let touchY = 0;

canvas.addEventListener("touchstart", e => {
    if (e.touches.length !== 1) return;

    touchX = e.touches[0].clientX;
    touchY = e.touches[0].clientY;
}, { passive: false });

canvas.addEventListener("touchmove", e => {
    e.preventDefault();

    if (e.touches.length !== 1) return;

    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;

    const dx = x - touchX;
    const dy = y - touchY;

    player.angle += dx * 0.008;
    player.pitch += dy * 0.8;

    player.pitch = Math.max(-120, Math.min(120, player.pitch));

    touchX = x;
    touchY = y;
}, { passive: false });

/* =========================
   КОЛЛИЗИИ
========================= */

function isWall(x, y) {
    const mx = Math.floor(x);
    const my = Math.floor(y);

    if (my < 0 || my >= map.length) return true;
    if (mx < 0 || mx >= map[my].length) return true;

    return map[my][mx] === "#";
}

function canMove(x, y) {
    const r = 0.2;

    return (
        !isWall(x - r, y - r) &&
        !isWall(x + r, y - r) &&
        !isWall(x - r, y + r) &&
        !isWall(x + r, y + r)
    );
}

/* =========================
   ДВИЖЕНИЕ
========================= */

function updateMovement(dt) {
    if (cameraScreen.style.display === "block") return;

    let forward = 0;
    let side = 0;

    if (keys["w"]) forward += 1;
    if (keys["s"]) forward -= 1;
    if (keys["a"]) side -= 1;
    if (keys["d"]) side += 1;

    const len = Math.hypot(forward, side);

    if (len > 0) {
        forward /= len;
        side /= len;

        const cos = Math.cos(player.angle);
        const sin = Math.sin(player.angle);

        const dx =
            (cos * forward - sin * side) *
            player.speed *
            dt;

        const dy =
            (sin * forward + cos * side) *
            player.speed *
            dt;

        if (canMove(player.x + dx, player.y)) {
            player.x += dx;
        }

        if (canMove(player.x, player.y + dy)) {
            player.y += dy;
        }
    }
}

/* =========================
   RAYCASTING
========================= */

const FOV = Math.PI / 3;

function castRay(angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    let distance = 0;

    const step = 0.025;

    while (distance < 30) {
        distance += step;

        const x = player.x + cos * distance;
        const y = player.y + sin * distance;

        if (isWall(x, y)) {
            return distance;
        }
    }

    return 30;
}

function render3D() {
    ctx.fillStyle = "#090909";
    ctx.fillRect(0, 0, W, H / 2);

    ctx.fillStyle = "#171717";
    ctx.fillRect(0, H / 2, W, H / 2);

    /*
        Вертикальное смещение обзора.
    */

    const horizon = H / 2 + player.pitch;

    for (let x = 0; x < W; x += 2) {

        const cameraX = x / W;

        const rayAngle =
            player.angle +
            (cameraX - 0.5) * FOV;

        let distance = castRay(rayAngle);

        /*
            Исправление fish-eye.
        */

        distance *= Math.cos(rayAngle - player.angle);

        const wallHeight =
            Math.min(H * 2, H / Math.max(distance, 0.05));

        const top =
            horizon - wallHeight / 2;

        const brightness =
            Math.max(25, 170 - distance * 10);

        ctx.fillStyle =
            `rgb(${brightness},${brightness},${brightness})`;

        ctx.fillRect(
            x,
            top,
            2,
            wallHeight
        );
    }

    renderObjects(horizon);
}

/* =========================
   ОБЪЕКТЫ
========================= */

function renderObjects(horizon) {

    const visible = [];

    for (const obj of objects) {

        const dx = obj.x - player.x;
        const dy = obj.y - player.y;

        const distance = Math.hypot(dx, dy);

        let relativeAngle =
            Math.atan2(dy, dx) - player.angle;

        while (relativeAngle > Math.PI)
            relativeAngle -= Math.PI * 2;

        while (relativeAngle < -Math.PI)
            relativeAngle += Math.PI * 2;

        if (Math.abs(relativeAngle) < FOV / 2) {

            visible.push({
                obj,
                distance,
                angle: relativeAngle
            });
        }
    }

    visible.sort((a, b) =>
        b.distance - a.distance
    );

    for (const item of visible) {

        const { obj, distance, angle } = item;

        const screenX =
            W / 2 +
            Math.tan(angle) /
            Math.tan(FOV / 2) *
            W / 2;

        const size =
            Math.min(
                H * 0.8,
                H / Math.max(distance, 0.2) * 0.7
            );

        const centerY = horizon;

        if (obj.type === "camera") {

            drawBox(
                screenX,
                centerY - size * 0.45,
                size * 0.45,
                size * 0.25,
                "#777"
            );

            drawCircle(
                screenX,
                centerY - size * 0.33,
                size * 0.09,
                "#111"
            );
        }

        if (obj.type === "computer") {

            drawBox(
                screenX,
                centerY - size * 0.45,
                size * 0.5,
                size * 0.35,
                "#555"
            );

            ctx.fillStyle = "#151515";
            ctx.fillRect(
                screenX - size * 0.19,
                centerY - size * 0.4,
                size * 0.38,
                size * 0.22
            );
        }

        if (obj.type === "shotgun") {

            ctx.save();

            ctx.translate(
                screenX,
                centerY
            );

            ctx.rotate(-0.2);

            ctx.fillStyle = "#4d4d4d";

            ctx.fillRect(
                -size * 0.12,
                -size * 0.05,
                size * 0.35,
                size * 0.07
            );

            ctx.fillStyle = "#222";

            ctx.fillRect(
                -size * 0.22,
                -size * 0.04,
                size * 0.12,
                size * 0.16
            );

            ctx.restore();
        }

        if (obj.type === "stove") {

            drawBox(
                screenX,
                centerY - size * 0.55,
                size * 0.5,
                size * 0.7,
                "#333"
            );

            drawCircle(
                screenX,
                centerY - size * 0.2,
                size * 0.15,
                "#999"
            );
        }
    }
}

function drawBox(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(
        x - w / 2,
        y - h / 2,
        w,
        h
    );
}

function drawCircle(x, y, r, color) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
}

/* =========================
   ВЗАИМОДЕЙСТВИЕ
========================= */

function getNearestObject() {

    let closest = null;
    let closestDistance = Infinity;

    for (const obj of objects) {

        const dx = obj.x - player.x;
        const dy = obj.y - player.y;

        const distance = Math.hypot(dx, dy);

        if (distance > 2) continue;

        let angle =
            Math.atan2(dy, dx) -
            player.angle;

        while (angle > Math.PI)
            angle -= Math.PI * 2;

        while (angle < -Math.PI)
            angle += Math.PI * 2;

        if (Math.abs(angle) > 0.5)
            continue;

        if (distance < closestDistance) {
            closestDistance = distance;
            closest = obj;
        }
    }

    return closest;
}

function interact() {

    const obj = getNearestObject();

    if (!obj) return;

    if (obj.type === "computer") {
        openCameraSystem();
        return;
    }

    if (obj.type === "shotgun") {

        player.weapon = "shotgun";

        weaponText.textContent =
            "Оружие: дробовик";

        ammoText.textContent =
            "Патроны: " + player.ammo;

        hint.textContent =
            "F — стрелять. Во время движения стрелять нельзя.";

        return;
    }

    if (obj.type === "camera") {

        hint.textContent =
            "Камера готова. Можно использовать вспышку.";

        flashCamera();

        return;
    }

    if (obj.type === "stove") {

        stove = 100;

        hint.textContent =
            "Ты подкинул топливо в печку.";

        return;
    }
}

/* =========================
   ДВЕРЬ
========================= */

let doorClosed = false;

function updateDoorInteraction() {

    const dx = 15.5 - player.x;
    const dy = 12.5 - player.y;

    const distance = Math.hypot(dx, dy);

    if (distance < 1.8) {

        hint.textContent =
            doorClosed
                ? "E — открыть дверь"
                : "E — закрыть дверь";

        if (keys["e"]) {
            doorClosed = !doorClosed;

            keys["e"] = false;
        }
    }
}

/* =========================
   ДРОБОВИК
========================= */

function shoot() {

    if (cameraScreen.style.display === "block")
        return;

    if (player.weapon !== "shotgun")
        return;

    if (player.ammo <= 0) {

        hint.textContent =
            "Дробовик пуст.";

        return;
    }

    /*
        Стрелять можно только когда игрок стоит.
    */

    if (
        keys["w"] ||
        keys["a"] ||
        keys["s"] ||
        keys["d"]
    ) {

        hint.textContent =
            "Нельзя стрелять во время движения.";

        return;
    }

    player.ammo--;

    ammoText.textContent =
        "Патроны: " + player.ammo;

    player.shooting = true;

    /*
        Вспышка выстрела.
    */

    ctx.fillStyle = "rgba(255,255,220,.8)";
    ctx.fillRect(0, 0, W, H);

    setTimeout(() => {
        player.shooting = false;
    }, 80);

    hint.textContent =
        "БАХ!";
}

/* =========================
   ВСПЫШКА КАМЕРЫ
========================= */

function flashCamera() {

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, W, H);

    setTimeout(() => {
        render3D();
    }, 100);

    hint.textContent =
        "ВСПЫШКА!";
}

/* =========================
   КАМЕРЫ
========================= */

let currentCamera = 0;

function openCameraSystem() {

    cameraScreen.style.display = "block";

    showCamera(0);
}

function closeCameraSystem() {

    cameraScreen.style.display = "none";

    hint.textContent =
        "WASD — движение | E — взаимодействие";
}

function showCamera(number) {

    currentCamera = number;

    const names = [
        "КАМЕРА 01 — ТОРГОВЫЙ ЗАЛ",
        "КАМЕРА 02 — СКЛАД",
        "КАМЕРА 03 — КОРИДОР"
    ];

    cameraText.textContent =
        names[number];

    /*
        Простая имитация изображения камер.
    */

    const view =
        document.getElementById("cameraView");

    if (number === 0) {
        view.style.background =
            "repeating-linear-gradient(0deg,rgba(255,255,255,.04) 0px,rgba(255,255,255,.04) 2px,transparent 2px,transparent 5px),#252525";
    }

    if (number === 1) {
        view.style.background =
            "repeating-linear-gradient(90deg,rgba(255,255,255,.03) 0px,rgba(255,255,255,.03) 4px,transparent 4px,transparent 8px),#151515";
    }

    if (number === 2) {
        view.style.background =
            "repeating-linear-gradient(0deg,rgba(255,255,255,.05) 0px,rgba(255,255,255,.05) 3px,transparent 3px,transparent 7px),#111";
    }
}

document.querySelectorAll("[data-cam]").forEach(button => {

    button.addEventListener("click", () => {

        const number =
            Number(button.dataset.cam);

        showCamera(number);
    });
});

closeCameras.addEventListener(
    "click",
    closeCameraSystem
);

/* =========================
   ПЕЧКА
========================= */

let stove = 100;

function updateStove(dt) {

    stove -= dt * 1.5;

    if (stove < 0)
        stove = 0;

    stoveFill.style.width =
        stove + "%";

    if (stove <= 25) {

        hint.textContent =
            "ПЕЧКА ПОЧТИ ПОГАСЛА! Нужно идти к ней.";
    }
}

/* =========================
   HUD
========================= */

function updateHint() {

    if (cameraScreen.style.display === "block")
        return;

    const obj = getNearestObject();

    if (obj) {

        if (obj.type === "computer")
            hint.textContent =
                "E — открыть камеры";

        else if (obj.type === "shotgun")
            hint.textContent =
                "E — взять дробовик";

        else if (obj.type === "camera")
            hint.textContent =
                "E — использовать вспышку";

        else if (obj.type === "stove")
            hint.textContent =
                "E — затопить печку";

    } else {

        hint.textContent =
            "WASD — движение | мышь — обзор | E — действие";
    }
}

/* =========================
   ИГРОВОЙ ЦИКЛ
========================= */

let lastTime = performance.now();

function gameLoop(time) {

    const dt =
        Math.min(
            (time - lastTime) / 1000,
            0.05
        );

    lastTime = time;

    updateMovement(dt);
    updateDoorInteraction();
    updateStove(dt);
    updateHint();

    render3D();

    requestAnimationFrame(gameLoop);
}

gameLoop(performance.now());

/* =========================
   СТАРТОВАЯ ПОЗИЦИЯ
========================= */

player.x = 12;
player.y = 10.5;
player.angle = Math.PI;
