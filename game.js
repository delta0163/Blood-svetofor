
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const $ = id => document.getElementById(id);

let W, H;

function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

/* =========================
   СОСТОЯНИЕ ИГРЫ
========================= */

let deviceMode = null;
let doorClosed = false;
let cameraOpen = false;
let currentCamera = 0;
let stove = 100;
let lastTime = performance.now();

const keys = {};

const player = {
    x: 11.5,
    y: 12.5,
    angle: -Math.PI / 2,
    pitch: 0,
    speed: 3,
    weapon: null,
    ammo: 4,
    shooting: false
};

/* =========================
   КАРТА
========================= */

const map = [
    "########################",
    "#########......#########",
    "#########......#########",
    "#########......#########",
    "#########......#########",
    "#########......#########",
    "#########......#########",
    "##....................##",
    "##....................##",
    "##....................##",
    "##....................##",
    "##....................##",
    "##....................##",
    "##....................##",
    "##....................##",
    "##....................##",
    "##....................##",
    "########################"
];

const objects = [
    { type: "camera", x: 3.5, y: 10.5 },
    { type: "computer", x: 10, y: 12.5 },
    { type: "shotgun", x: 12.5, y: 12.5 },
    { type: "stove", x: 11.5, y: 2.5 }
];

const door = { x: 21, y: 10.5 };

/* =========================
   ВЫБОР УСТРОЙСТВА
========================= */

$("pcMode").onclick = () => startGame("pc");
$("mobileMode").onclick = () => startGame("mobile");

function startGame(mode) {
    deviceMode = mode;
    $("deviceMenu").style.display = "none";

    document.body.classList.toggle(
        "mobile-mode",
        mode === "mobile"
    );

    $("interaction").textContent =
        mode === "mobile"
            ? "Джойстик — движение | Палец — обзор"
            : "WASD — движение | Мышь — обзор";
}

/* =========================
   КЛАВИАТУРА
========================= */

window.addEventListener("keydown", e => {
    const k = e.key.toLowerCase();

    if (["w", "a", "s", "d", " "].includes(k)) {
        e.preventDefault();
    }

    keys[k] = true;

    if (e.repeat) return;

    if (k === "e") interact();
    if (k === "f") shoot();
    if (k === "escape") closeCameraSystem();
});

window.addEventListener("keyup", e => {
    keys[e.key.toLowerCase()] = false;
});

function isMoving() {
    return keys.w || keys.a || keys.s || keys.d;
}

/* =========================
   МЫШЬ И СЕНСОРНЫЙ ОБЗОР
========================= */

let mouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;

canvas.addEventListener("mousedown", e => {
    if (deviceMode !== "pc") return;

    mouseDown = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});

window.addEventListener("mouseup", () => {
    mouseDown = false;
});

window.addEventListener("mousemove", e => {
    if (!mouseDown || deviceMode !== "pc" || cameraOpen) return;

    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    look(dx, dy);
});

function look(dx, dy) {
    player.angle += dx * 0.004;
    player.pitch = Math.max(
        -180,
        Math.min(180, player.pitch + dy * 0.7)
    );
}

/* Сенсорный обзор: движение пальцем по свободной части экрана */

let lookTouch = null;

canvas.addEventListener("pointerdown", e => {
    if (deviceMode !== "mobile" || cameraOpen) return;

    if (e.clientX < W * 0.27 || e.clientX > W * 0.72) return;

    lookTouch = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY
    };

    canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", e => {
    if (!lookTouch || e.pointerId !== lookTouch.id) return;

    const dx = e.clientX - lookTouch.x;
    const dy = e.clientY - lookTouch.y;

    look(dx, dy);

    lookTouch.x = e.clientX;
    lookTouch.y = e.clientY;
});

function endLook(e) {
    if (lookTouch && e.pointerId === lookTouch.id) {
        lookTouch = null;
    }
}

canvas.addEventListener("pointerup", endLook);
canvas.addEventListener("pointercancel", endLook);

/* =========================
   МОБИЛЬНЫЙ ДЖОЙСТИК
========================= */

document.querySelectorAll(".moveBtn").forEach(button => {
    const key = button.dataset.key;

    button.addEventListener("pointerdown", e => {
        if (deviceMode !== "mobile") return;

        e.preventDefault();
        keys[key] = true;
        button.setPointerCapture(e.pointerId);
    });

    function release() {
        keys[key] = false;
    }

    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
});

/* =========================
   КОЛЛИЗИИ
========================= */

function isWall(x, y) {
    const mx = Math.floor(x);
    const my = Math.floor(y);

    if (my < 0 || my >= map.length) return true;
    if (mx < 0 || mx >= map[my].length) return true;

    if (
        Math.floor(door.x) === mx &&
        Math.floor(door.y) === my
    ) {
        return doorClosed;
    }

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
    if (cameraOpen) return;

    let forward = 0;
    let side = 0;

    if (keys.w) forward++;
    if (keys.s) forward--;
    if (keys.a) side--;
    if (keys.d) side++;

    const len = Math.hypot(forward, side);

    if (!len) return;

    forward /= len;
    side /= len;

    const dx =
        (Math.cos(player.angle) * forward -
         Math.sin(player.angle) * side) *
        player.speed * dt;

    const dy =
        (Math.sin(player.angle) * forward +
         Math.cos(player.angle) * side) *
        player.speed * dt;

    if (canMove(player.x + dx, player.y)) {
        player.x += dx;
    }

    if (canMove(player.x, player.y + dy)) {
        player.y += dy;
    }
}

/* =========================
   RAYCASTING
========================= */

const FOV = Math.PI / 3;
const depthBuffer = [];

function castRay(angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    let distance = 0;

    while (distance < 30) {
        distance += 0.025;

        const x = player.x + cos * distance;
        const y = player.y + sin * distance;

        if (isWall(x, y)) return distance;
    }

    return 30;
}

function render3D() {
    const horizon = H / 2 + player.pitch;

    ctx.fillStyle = "#101010";
    ctx.fillRect(0, 0, W, horizon);

    ctx.fillStyle = "#26231f";
    ctx.fillRect(0, horizon, W, H - horizon);

    const strip = 3;

    for (let x = 0; x < W; x += strip) {
        const cameraX = x / W;

        const rayAngle =
            player.angle + (cameraX - 0.5) * FOV;

        let distance = castRay(rayAngle);

        distance *= Math.cos(rayAngle - player.angle);
        depthBuffer[Math.floor(x / strip)] = distance;

        const wallHeight =
            Math.min(H * 3, H / Math.max(distance, 0.05));

        const top = horizon - wallHeight / 2;

        const shade = Math.max(
            18,
            Math.floor(165 / (1 + distance * 0.16))
        );

        ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
        ctx.fillRect(x, top, strip + 1, wallHeight);

        ctx.fillStyle = `rgba(0,0,0,${Math.min(.65, distance / 22)})`;
        ctx.fillRect(x, top, strip + 1, wallHeight);
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

        let angle = Math.atan2(dy, dx) - player.angle;

        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;

        if (Math.abs(angle) < FOV / 2 + 0.3) {
            visible.push({ obj, distance, angle });
        }
    }

    visible.sort((a, b) => b.distance - a.distance);

    for (const item of visible) {
        const { obj, distance, angle } = item;

        const screenX =
            W / 2 +
            Math.tan(angle) / Math.tan(FOV / 2) * W / 2;

        const size = Math.min(
            H * 0.8,
            H / Math.max(distance, 0.2) * 0.7
        );

        const y = horizon;

        if (obj.type === "camera") {
            box(screenX, y - size * .4, size * .5, size * .3, "#777");
            box(screenX, y - size * .4, size * .15, size * .15, "#111");
        }

        if (obj.type === "computer") {
            box(screenX, y - size * .4, size * .65, size * .45, "#555");
            box(screenX, y - size * .42, size * .5, size * .25, "#19302d");
            box(screenX, y - size * .1, size * .1, size * .2, "#444");
        }

        if (obj.type === "shotgun") {
            box(screenX, y, size * .5, size * .07, "#555");
            box(screenX - size * .15, y + size * .08, size * .18, size * .2, "#28211c");
        }

        if (obj.type === "stove") {
            box(screenX, y - size * .3, size * .55, size * .7, "#3d3935");
            box(screenX, y - size * .3, size * .3, size * .3, "#d84c13");
            box(screenX, y - size * .3, size * .16, size * .16, "#ffb42b");
        }
    }
}

function box(x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
}

/* =========================
   ВЗАИМОДЕЙСТВИЕ
========================= */

function getNearestObject() {
    let nearest = null;
    let best = Infinity;

    for (const obj of objects) {
        const dx = obj.x - player.x;
        const dy = obj.y - player.y;
        const distance = Math.hypot(dx, dy);

        if (distance > 2.2) continue;

        let angle = Math.atan2(dy, dx) - player.angle;

        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;

        if (Math.abs(angle) > 0.8) continue;

        if (distance < best) {
            best = distance;
            nearest = obj;
        }
    }

    return nearest;
}

function nearDoor() {
    return Math.hypot(
        door.x - player.x,
        door.y - player.y
    ) < 2.2;
}

function interact() {
    if (cameraOpen) return;

    if (nearDoor()) {
        doorClosed = !doorClosed;
        $("interaction").textContent =
            doorClosed ? "Дверь закрыта." : "Дверь открыта.";
        return;
    }

    const obj = getNearestObject();

    if (!obj) return;

    if (obj.type === "computer") {
        openCameraSystem();
    }

    if (obj.type === "shotgun") {
        player.weapon = "shotgun";
        $("weapon").textContent = "Оружие: дробовик";
        $("ammo").textContent = "Патроны: " + player.ammo;
        $("interaction").textContent = "F / ОГОНЬ — стрелять. Только стоя.";
    }

    if (obj.type === "camera") {
        flashCamera();
    }

    if (obj.type === "stove") {
        stove = 100;
        $("interaction").textContent = "Ты затопил печку.";
    }
}

/* =========================
   ДВЕРЬ
========================= */

$("mobileDoor").onclick = () => {
    if (deviceMode !== "mobile") return;

    if (nearDoor()) {
        doorClosed = !doorClosed;
        $("interaction").textContent =
            doorClosed ? "Дверь закрыта." : "Дверь открыта.";
    } else {
        $("interaction").textContent = "Подойди к двери.";
    }
};

/* =========================
   ДРОБОВИК
========================= */

function shoot() {
    if (cameraOpen || player.weapon !== "shotgun") return;

    if (isMoving()) {
        $("interaction").textContent = "Нельзя стрелять во время движения.";
        return;
    }

    if (player.ammo <= 0) {
        $("interaction").textContent = "Патроны закончились.";
        return;
    }

    player.ammo--;
    $("ammo").textContent = "Патроны: " + player.ammo;

    player.shooting = true;

    ctx.fillStyle = "rgba(255,220,130,.65)";
    ctx.fillRect(0, 0, W, H);

    setTimeout(() => {
        player.shooting = false;
    }, 100);

    $("interaction").textContent = "БАХ!";
}

$("mobileInteract").onclick = () => {
    if (deviceMode === "mobile") interact();
};

$("mobileShoot").onclick = () => {
    if (deviceMode === "mobile") shoot();
};

/* =========================
   ВСПЫШКА
========================= */

function flashCamera() {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, W, H);

    setTimeout(() => render3D(), 100);

    $("interaction").textContent = "ВСПЫШКА!";
}

$("mobileFlash").onclick = () => {
    if (deviceMode !== "mobile") return;

    const obj = getNearestObject();

    if (obj && obj.type === "camera") {
        flashCamera();
    } else {
        $("interaction").textContent = "Подойди к камере.";
    }
};

/* =========================
   КАМЕРЫ
========================= */

function openCameraSystem() {
    cameraOpen = true;
    $("cameraScreen").style.display = "block";
    showCamera(0);
}

function closeCameraSystem() {
    cameraOpen = false;
    $("cameraScreen").style.display = "none";
}

$("closeCameras").onclick = closeCameraSystem;

document.querySelectorAll("[data-cam]").forEach(button => {
    button.onclick = () => {
        showCamera(Number(button.dataset.cam));
    };
});

$("mobileCameras").onclick = () => {
    if (deviceMode !== "mobile") return;

    if (cameraOpen) {
        closeCameraSystem();
    } else {
        const obj = getNearestObject();

        if (obj && obj.type === "computer") {
            openCameraSystem();
        } else {
            $("interaction").textContent = "Подойди к компьютеру.";
        }
    }
};

function showCamera(number) {
    currentCamera = number;

    const names = [
        "КАМЕРА 01 — ТОРГОВЫЙ ЗАЛ",
        "КАМЕРА 02 — СКЛАД",
        "КАМЕРА 03 — КОРИДОР"
    ];

    $("cameraText").textContent = names[number];

    const colors = ["#252525", "#151515", "#101010"];

    $("cameraView").style.background = colors[number];
}

/* =========================
   ПЕЧКА
========================= */

function updateStove(dt) {
    stove = Math.max(0, stove - dt * 1.5);

    $("stoveFill").style.width = stove + "%";

    if (stove <= 25) {
        $("interaction").textContent = "ПЕЧКА ПОЧТИ ПОГАСЛА!";
    }
}

/* =========================
   ПОДСКАЗКИ
========================= */

function updateHint() {
    if (cameraOpen) return;

    if (nearDoor()) {
        $("interaction").textContent =
            doorClosed ? "E — открыть дверь" : "E — закрыть дверь";
        return;
    }

    const obj = getNearestObject();

    if (!obj) return;

    const hints = {
        computer: "E — открыть камеры",
        shotgun: "E — взять дробовик",
        camera: "E — использовать вспышку",
        stove: "E — затопить печку"
    };

    $("interaction").textContent = hints[obj.type] || "";
}

/* =========================
   ИГРОВОЙ ЦИКЛ
========================= */

function gameLoop(time) {
    const dt = Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;

    if (deviceMode) {
        updateMovement(dt);
        updateStove(dt);
        updateHint();
    }

    render3D();

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
