// ================= CANVAS =================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

let viewWidth = 640, viewHeight = 360, scale = 1;

function resize() {
    const maxW = window.innerWidth;
    const maxH = window.innerHeight * 0.68;
    scale = Math.max(1, Math.min(Math.floor(maxW / 480), Math.floor(maxH / 320)));
    viewWidth = Math.floor(maxW / scale);
    viewHeight = Math.floor(maxH / scale);
    canvas.width = viewWidth;
    canvas.height = viewHeight;
    canvas.style.width = (viewWidth * scale) + 'px';
    canvas.style.height = (viewHeight * scale) + 'px';
    ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));

// ================= СОСТОЯНИЕ =================
const GROUND_Y = 300;

const state = {
    money: 0,
    rep: 0,
    energy: 100,
    chapter: 1,
    phase: 'start', // start | cutscene | game | chapter | end
    location: 'Комната в общежитии',
    flags: {}       // сюжетные флаги
};

// ================= ИГРОК =================
const player = {
    x: 100, y: GROUND_Y - 32,
    w: 22, h: 32, vx: 0, vy: 0,
    speed: 2.4, facing: 1, onGround: true,
    walkFrame: 0, walkTimer: 0,
    actionTimer: 0, invulnTimer: 0,
    stepTimer: 0
};

const keys = { left: false, right: false };

// ================= ЛОКАЦИИ =================
const locations = {
    room: {
        name: 'Комната в общежитии',
        width: 1200,
        bgType: 'room',
        music: 'spb',
        platforms: [
            { x: 0, y: GROUND_Y, w: 1200, h: 60 },
            { x: 480, y: GROUND_Y - 70, w: 100, h: 12 },
            { x: 800, y: GROUND_Y - 120, w: 120, h: 12 }
        ],
        objects: [
            {
                x: 200, y: GROUND_Y - 40, w: 40, h: 40,
                type: 'computer', name: '💻 Ноутбук',
                dialogue: [
                    'Старый ноутбук, работает на честном слове.',
                    'Может, помайнить крипту? Или написать код для стартапа?'
                ],
                action: 'scene_crypto_start',
                needs: { money: 0 }
            },
            {
                x: 600, y: GROUND_Y - 60, w: 50, h: 60,
                type: 'poster', name: '📈 Плакат с биткоином',
                dialogue: ['График биткоина. Если бы я купил его в 2010...'],
                action: 'poster',
                needs: {}
            },
            {
                x: 1050, y: GROUND_Y - 40, w: 40, h: 60,
                type: 'door', name: '🚪 Выход',
                dialogue: ['Пора выйти в город. Питер ждёт.'],
                action: 'goto_spb',
                needs: { money: 200 }
            }
        ]
    },
    spb: {
        name: 'Невский проспект',
        width: 2400,
        bgType: 'city',
        music: 'spb',
        platforms: [{ x: 0, y: GROUND_Y, w: 2400, h: 60 }],
        objects: [
            {
                x: 300, y: GROUND_Y - 60, w: 40, h: 60,
                type: 'npc', name: '🎸 Уличный музыкант',
                dialogue: ['Эй, парень! Хочешь подзаработать? Помоги мне выступить!'],
                action: 'scene_street_music',
                needs: {},
                once: false
            },
            {
                x: 800, y: GROUND_Y - 60, w: 40, h: 60,
                type: 'npc', name: '💼 Инвестор',
                dialogue: ['Есть идея для стартапа. Вложи 500₽ — расскажу детали.'],
                action: 'scene_investor',
                needs: { money: 500 }
            },
            {
                x: 1400, y: GROUND_Y - 60, w: 40, h: 60,
                type: 'npc', name: '🪙 Крипто-трейдер',
                dialogue: ['Новый токен! 100x за неделю! Нужен капитал. Рискнёшь?'],
                action: 'scene_crypto_trade',
                needs: { money: 1000 }
            },
            {
                x: 2000, y: GROUND_Y - 60, w: 50, h: 60,
                type: 'door', name: '🏢 Бизнес-центр',
                dialogue: ['Огромное здание. Здесь делают деньги.'],
                action: 'goto_business',
                needs: { rep: 20 }
            }
        ]
    },
    business: {
        name: 'Бизнес-центр',
        width: 1600,
        bgType: 'office',
        music: 'business',
        platforms: [{ x: 0, y: GROUND_Y, w: 1600, h: 60 }],
        objects: [
            {
                x: 400, y: GROUND_Y - 60, w: 40, h: 60,
                type: 'npc', name: '🤝 Партнёр',
                dialogue: ['Ваша идея интересна. Давайте обсудим сотрудничество.'],
                action: 'scene_partner',
                needs: {}
            },
            {
                x: 1000, y: GROUND_Y - 60, w: 40, h: 60,
                type: 'npc', name: '👔 Инвестор-ангел',
                dialogue: ['Готов вложить в ваш проект, если покажете результат.'],
                action: 'scene_angel',
                needs: { rep: 50 }
            },
            {
                x: 1400, y: GROUND_Y - 40, w: 40, h: 60,
                type: 'door', name: '🚪 На улицу',
                dialogue: ['Выйти на улицу.'],
                action: 'goto_spb',
                needs: {}
            }
        ]
    }
};

let currentLocationKey = 'room';
let world = locations[currentLocationKey];
let camera = { x: 0 };

// ================= КАТ-СЦЕНЫ =================
const PROLOGUE = [
    { text: 'Ты — молодой парень из провинции.', portrait: '🧑', bg: 'linear-gradient(180deg,#1a1a3e,#4a3a6e)' },
    { text: 'В кармане — 500 рублей, в голове — миллион идей.', portrait: '🧑', bg: 'linear-gradient(180deg,#1a1a3e,#4a3a6e)' },
    { text: 'Билет в один конец до Санкт-Петербурга.', portrait: '🚂', bg: 'linear-gradient(180deg,#2a1a3e,#6e3a5e)' },
    { text: 'Питер встречает туманом и дождём.', portrait: '🌫️', bg: 'linear-gradient(180deg,#2a3a4e,#4a5a6e)' },
    { text: 'Ты снимаешь крохотную комнату в общежитии.', portrait: '🏚️', bg: 'linear-gradient(180deg,#1a1a2e,#3a2a3e)' },
    { text: '500 рублей — это всё, что у тебя есть.', portrait: '💵', bg: 'linear-gradient(180deg,#1a1a2e,#3a2a3e)' },
    { text: 'Теперь всё зависит только от тебя.', portrait: '🧑', bg: 'linear-gradient(180deg,#1a1a2e,#3a2a3e)' },
    { text: 'Заработай денег. Стань успешным.', portrait: '💰', bg: 'linear-gradient(180deg,#2a2a1e,#6e5a2e)' }
];

const STORY_SCENES = {
    scene_crypto_start: {
        lines: [
            { text: 'Ты открываешь ноутбук и заходишь на крипто-биржу.', portrait: '💻' },
            { text: 'Курсы скачут вверх и вниз, как бешеные.', portrait: '📈' },
            { text: 'Ты решаешь купить на все 500 рублей...', portrait: '🪙' },
            { text: 'Прошло три часа. Ты заработал первые 700 рублей!', portrait: '💰' }
        ],
        reward: { money: 700 },
        unlock: 'first_crypto'
    },
    scene_street_music: {
        lines: [
            { text: 'Ты присоединяешься к уличному музыканту.', portrait: '🎸' },
            { text: 'Играете несколько часов у метро.', portrait: '🎶' },
            { text: 'Прохожие бросают монеты в шляпу.', portrait: '💰' },
            { text: 'Заработано 150₽ и +5 репутации!', portrait: '⭐' }
        ],
        reward: { money: 150, rep: 5 }
    },
    scene_investor: {
        lines: [
            { text: 'Инвестор рассказывает про стартап доставки.', portrait: '💼' },
            { text: 'Ты вкладываешь 500 рублей в бизнес.', portrait: '💸' },
            { text: 'Через неделю — первый доход!', portrait: '📈' },
            { text: 'Заработано 800₽ и +10 репутации!', portrait: '🎉' }
        ],
        reward: { money: 800, rep: 10 },
        cost: 500
    },
    scene_crypto_trade: {
        lines: [
            { text: 'Ты покупаешь новый токен на все деньги.', portrait: '🪙' },
            { text: 'Курс летит вверх... затем падает...', portrait: '📉' },
            { text: 'Но ты вовремя продаёшь!', portrait: '💰' },
            { text: 'Прибыль 1200₽ и +15 репутации!', portrait: '🚀' }
        ],
        reward: { money: 1200, rep: 15 },
        cost: 1000
    },
    scene_partner: {
        lines: [
            { text: 'Ты встречаешься с потенциальным партнёром.', portrait: '🤝' },
            { text: 'Обсуждаете совместный проект.', portrait: '💼' },
            { text: 'Партнёр соглашается вложиться!', portrait: '💵' },
            { text: '+2000₽ и +20 репутации!', portrait: '🎊' }
        ],
        reward: { money: 2000, rep: 20 }
    },
    scene_angel: {
        lines: [
            { text: 'Инвестор-ангел изучает твой проект.', portrait: '👔' },
            { text: 'Он впечатлён твоими результатами.', portrait: '📊' },
            { text: 'Подписан контракт на крупную сумму!', portrait: '📝' },
            { text: '+5000₽ и +30 репутации!', portrait: '🏆' },
            { text: '🎉 Ты добился успеха в Санкт-Петербурге!', portrait: '🌟', win: true }
        ],
        reward: { money: 5000, rep: 30 },
        win: true
    }
};

// ================= КАТ-СЦЕНА UI =================
const cutsceneEl = document.getElementById('cutscene');
const cutsceneBgEl = document.getElementById('cutscene-bg');
const cutsceneTextEl = document.getElementById('cutscene-text');
const cutscenePortraitEl = document.getElementById('cutscene-portrait');
const dialogueEl = document.getElementById('dialogue');
const dialogueNameEl = document.getElementById('dialogue-name');
const dialogueTextEl = document.getElementById('dialogue-text');
const hintEl = document.getElementById('hint');
const moneyEl = document.getElementById('money');
const repEl = document.getElementById('rep');
const energyEl = document.getElementById('energy');
const locationEl = document.getElementById('location');
const btnInteract = document.getElementById('btn-interact');
const btnAction = document.getElementById('btn-action');
const chapterEl = document.getElementById('chapter-screen');
const chapterTitleEl = document.getElementById('chapter-title');
const chapterSubEl = document.getElementById('chapter-subtitle');
const endEl = document.getElementById('end-screen');
const endTitleEl = document.getElementById('end-title');
const endTextEl = document.getElementById('end-text');
const startScreen = document.getElementById('start-screen');

let cutsceneLines = [];
let cutsceneIdx = 0;
let cutsceneAfter = null;
let cutsceneIsPrologue = false;

let dialogueActive = false;
let dialogueObject = null;
let dialogueIdx = 0;

let typingTimer = null;

function typeText(el, text, speed = 25, cb) {
    el.textContent = '';
    let i = 0;
    if (typingTimer) clearInterval(typingTimer);
    typingTimer = setInterval(() => {
        if (i < text.length) {
            el.textContent += text[i++];
            if (i % 3 === 0) AudioSys.play('type');
        } else {
            clearInterval(typingTimer);
            typingTimer = null;
            cb && cb();
        }
    }, speed);
}

function showCutscene(lines, after, isPrologue = false) {
    state.phase = 'cutscene';
    cutsceneLines = lines;
    cutsceneIdx = 0;
    cutsceneAfter = after;
    cutsceneIsPrologue = isPrologue;
    cutsceneEl.classList.remove('hidden');
    startScreen.classList.add('hidden');
    AudioSys.playMusic('cutscene');
    showCutsceneLine();
}

function showCutsceneLine() {
    const line = cutsceneLines[cutsceneIdx];
    if (!line) return endCutscene();

    if (line.bg) {
        cutsceneBgEl.style.background = line.bg;
        cutsceneBgEl.style.backgroundSize = 'cover';
        cutsceneBgEl.classList.remove('visible');
        requestAnimationFrame(() => cutsceneBgEl.classList.add('visible'));
    }

    cutscenePortraitEl.textContent = line.portrait || '🧑';
    typeText(cutsceneTextEl, line.text, 22);
    AudioSys.play('scene');

    // Награды применяются сразу при показе строки с reward
    if (line.reward) applyReward(line.reward);
    if (line.win) state.flags.win = true;
}

function nextCutscene() {
    if (typingTimer) {
        clearInterval(typingTimer);
        typingTimer = null;
        cutsceneTextEl.textContent = cutsceneLines[cutsceneIdx].text;
        return;
    }
    cutsceneIdx++;
    if (cutsceneIdx >= cutsceneLines.length) {
        endCutscene();
    } else {
        showCutsceneLine();
    }
}

function endCutscene() {
    cutsceneEl.classList.add('hidden');

    // Глава пролога
    if (cutsceneIsPrologue) {
        showChapter('Глава 1', 'Первые шаги', () => {
            state.phase = 'game';
            switchLocation('room');
        });
        return;
    }

    if (state.flags.win) {
        showEnd();
        return;
    }

    if (cutsceneAfter) {
        const cb = cutsceneAfter;
        cutsceneAfter = null;
        cb();
    }
    state.phase = 'game';
}

function applyReward(reward) {
    if (!reward) return;
    if (reward.money) {
        state.money += reward.money;
        if (reward.money > 0) AudioSys.play('coin');
    }
    if (reward.rep) state.rep += reward.rep;
    updateHUD();
}

// ================= ГЛАВЫ И ФИНАЛ =================
function showChapter(title, subtitle, cb) {
    state.phase = 'chapter';
    chapterTitleEl.textContent = title;
    chapterSubEl.textContent = subtitle;
    chapterEl.classList.remove('hidden');
    AudioSys.play('chapter');
    setTimeout(() => {
        chapterEl.classList.add('hidden');
        cb && cb();
    }, 2200);
}

function showEnd() {
    state.phase = 'end';
    AudioSys.playMusic('victory');
    AudioSys.play('win');
    endTitleEl.textContent = '🌟 Ты добился успеха!';
    endTextEl.textContent = `Денег заработано: ${state.money}₽\nРепутация: ${state.rep}\n\nИстория о парне из провинции, который покорил Санкт-Петербург. Конец.`;
    endEl.classList.remove('hidden');
}

// ================= ДИАЛОГ =================
function startDialogue(obj) {
    dialogueObject = obj;
    dialogueIdx = 0;
    dialogueActive = true;
    dialogueEl.classList.remove('hidden');
    showDialogueLine();
    AudioSys.play('interact');
}

function showDialogueLine() {
    const text = dialogueObject.dialogue[dialogueIdx];
    dialogueNameEl.textContent = dialogueObject.name || '';
    typeText(dialogueTextEl, text, 20);
}

function nextDialogue() {
    if (typingTimer) {
        clearInterval(typingTimer);
        typingTimer = null;
        dialogueTextEl.textContent = dialogueObject.dialogue[dialogueIdx];
        return;
    }
    dialogueIdx++;
    if (dialogueIdx >= dialogueObject.dialogue.length) {
        endDialogue();
    } else {
        showDialogueLine();
    }
}

function endDialogue() {
    const obj = dialogueObject;
    dialogueActive = false;
    dialogueObject = null;
    dialogueEl.classList.add('hidden');

    // Проверка на requirements
    const needs = obj.needs || {};
    if (needs.money && state.money < needs.money) {
        AudioSys.play('fail');
        showToast('Нужно ' + needs.money + '₽!');
        return;
    }
    if (needs.rep && state.rep < needs.rep) {
        AudioSys.play('fail');
        showToast('Нужно ' + needs.rep + ' репутации!');
        return;
    }

    // Действие
    if (obj.action === 'goto_spb') { switchLocation('spb'); return; }
    if (obj.action === 'goto_business') { switchLocation('business'); return; }
    if (obj.action === 'poster') { AudioSys.play('coin'); state.rep += 1; updateHUD(); return; }

    const scene = STORY_SCENES[obj.action];
    if (scene) {
        // Списываем стоимость
        if (scene.cost) {
            if (state.money < scene.cost) {
                AudioSys.play('fail');
                showToast('Не хватает денег!');
                return;
            }
            state.money -= scene.cost;
            updateHUD();
        }
        showCutscene(scene.lines, null, false);
    }
}

// ================= ПЕРЕКЛЮЧЕНИЕ ЛОКАЦИЙ =================
function switchLocation(key) {
    if (!locations[key]) return;
    currentLocationKey = key;
    world = locations[key];
    state.location = world.name;
    locationEl.textContent = world.name;

    player.x = 100;
    player.y = GROUND_Y - player.h;
    camera.x = 0;

    AudioSys.playMusic(world.music);
    AudioSys.play('click');

    // Обновляем подсказку по объектам
    updateHUD();
}

// ================= УПРАВЛЕНИЕ =================
function bindButton(id, onDown, onUp) {
    const el = document.getElementById(id);
    if (!el) return;
    const down = (e) => {
        e.preventDefault();
        el.classList.add('pressed');
        onDown && onDown();
    };
    const up = (e) => {
        e.preventDefault();
        el.classList.remove('pressed');
        onUp && onUp();
    };
    el.addEventListener('touchstart', down, { passive: false });
    el.addEventListener('touchend', up, { passive: false });
    el.addEventListener('touchcancel', up, { passive: false });
    el.addEventListener('mousedown', down);
    el.addEventListener('mouseup', up);
    el.addEventListener('mouseleave', up);
}

bindButton('btn-left', () => keys.left = true, () => keys.left = false);
bindButton('btn-right', () => keys.right = true, () => keys.right = false);
bindButton('btn-action', () => tryAction());
bindButton('btn-interact', () => tryInteract());

document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = true;
    if (e.key === 'e' || e.key === 'E' || e.key === 'Enter') { e.preventDefault(); tryInteract(); }
    if (e.key === ' ') { e.preventDefault(); tryAction(); }
    if (e.key === 'Escape') { if (dialogueActive) endDialogue(); }
});
document.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') keys.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') keys.right = false;
});

document.getElementById('dialogue-next').addEventListener('click', nextDialogue);
document.getElementById('cutscene-next').addEventListener('click', nextCutscene);
document.getElementById('cutscene-skip').addEventListener('click', () => {
    if (typingTimer) { clearInterval(typingTimer); typingTimer = null; }
    endCutscene();
});

document.getElementById('btn-sound').addEventListener('click', (e) => {
    AudioSys.init();
    AudioSys.resume();
    const m = AudioSys.toggleMute();
    e.target.textContent = m ? '🔇' : '🔊';
});

document.getElementById('btn-start').addEventListener('click', (e) => {
    AudioSys.init();
    AudioSys.resume();
    AudioSys.play('click');
    startScreen.classList.add('hidden');
    state.money = 500;
    updateHUD();
    showCutscene(PROLOGUE, null, true);
});

document.getElementById('btn-restart').addEventListener('click', () => location.reload());

// ================= ВЗАИМОДЕЙСТВИЕ =================
function getNearbyObject() {
    const reach = 45;
    const pcx = player.x + player.w / 2;
    const pcy = player.y + player.h / 2;
    for (const obj of world.objects) {
        const ocx = obj.x + obj.w / 2;
        const ocy = obj.y + obj.h / 2;
        if (Math.abs(pcx - ocx) < reach + obj.w / 2 && Math.abs(pcy - ocy) < 70) return obj;
    }
    return null;
}

function tryInteract() {
    AudioSys.init(); AudioSys.resume();
    if (state.phase !== 'game') return;
    if (dialogueActive) { nextDialogue(); return; }
    const obj = getNearbyObject();
    if (obj) startDialogue(obj);
}

function tryAction() {
    AudioSys.init(); AudioSys.resume();
    if (state.phase !== 'game') return;
    if (dialogueActive) { nextDialogue(); return; }
    player.actionTimer = 20;
    // Действие без объекта - обновление репутации/энергии
    const obj = getNearbyObject();
    if (obj) startDialogue(obj);
}

// ================= ТОСТЫ =================
function showToast(msg) {
    hintEl.textContent = msg;
    hintEl.style.color = '#ff7777';
    setTimeout(() => {
        hintEl.style.color = '#ffff88';
        hintEl.textContent = '';
    }, 1800);
}

function updateHUD() {
    moneyEl.textContent = state.money;
    repEl.textContent = state.rep;
    energyEl.textContent = state.energy;
}

// ================= ОБНОВЛЕНИЕ =================
function update(dt) {
    // Анимация в любом состоянии
    if (state.phase === 'cutscene') return;

    if (dialogueActive) return;

    // Движение
    player.vx = 0;
    if (keys.left)  { player.vx = -player.speed; player.facing = -1; }
    if (keys.right) { player.vx =  player.speed; player.facing = 1; }

    // Анимация шагов
    if (player.vx !== 0 && player.onGround) {
        player.walkTimer++;
        if (player.walkTimer > 6) {
            player.walkTimer = 0;
            player.walkFrame = (player.walkFrame + 1) % 2;
        }
        player.stepTimer++;
        if (player.stepTimer > 18) {
            player.stepTimer = 0;
            AudioSys.play('step');
        }
    } else {
        player.walkFrame = 0;
    }

    player.x += player.vx;
    if (player.x < 0) player.x = 0;
    if (player.x + player.w > world.width) player.x = world.width - player.w;

    // Гравитация
    player.vy += 0.55;
    if (player.vy > 12) player.vy = 12;
    const prevY = player.y;
    player.y += player.vy;
    player.onGround = false;

    for (const p of world.platforms) {
        if (player.x + player.w > p.x && player.x < p.x + p.w) {
            if (player.vy >= 0 && prevY + player.h <= p.y + 2 && player.y + player.h >= p.y) {
                player.y = p.y - player.h;
                player.vy = 0;
                player.onGround = true;
            }
        }
    }

    if (player.y > viewHeight + 100) {
        // Респаун
        player.x = 100;
        player.y = GROUND_Y - player.h;
        player.vy = 0;
    }

    // Таймеры
    if (player.actionTimer > 0) player.actionTimer--;
    if (player.invulnTimer > 0) player.invulnTimer--;

    // Камера
    const targetCamX = player.x + player.w / 2 - viewWidth / 2;
    camera.x += (targetCamX - camera.x) * 0.12;
    camera.x = Math.max(0, Math.min(world.width - viewWidth, camera.x));

    // Индикатор взаимодействия
    const near = getNearbyObject();
    if (near && !dialogueActive) {
        btnInteract.classList.remove('hidden');
        hintEl.textContent = '✋ ' + near.name;
    } else {
        btnInteract.classList.add('hidden');
        if (!hintEl.textContent || hintEl.textContent.startsWith('✋')) {
            hintEl.textContent = '';
        }
    }
}

// ================= РИСОВАНИЕ =================
let time = 0;
let rainDrops = [];
for (let i = 0; i < 60; i++) {
    rainDrops.push({ x: Math.random() * 800, y: Math.random() * 400, s: 2 + Math.random() * 3 });
}

function drawBackground() {
    const bgType = world.bgType;

    if (bgType === 'room') {
        // Комната - тёмный фон с окном
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, viewWidth, viewHeight);
        // Обои
        ctx.fillStyle = '#22223e';
        for (let x = 0; x < viewWidth; x += 32) {
            ctx.fillRect(x, 0, 1, GROUND_Y);
        }
        // Окно
        const wx = 400 - camera.x;
        ctx.fillStyle = '#0a1a3e';
        ctx.fillRect(wx, 60, 120, 100);
        // Звёзды в окне
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 20; i++) {
            const sx = wx + (i * 13) % 110 + 5;
            const sy = 65 + (i * 17) % 90;
            ctx.fillRect(sx, sy, 1, 1);
        }
        // Луна
        ctx.fillStyle = '#ffffcc';
        ctx.beginPath();
        ctx.arc(wx + 90, 90, 12, 0, Math.PI * 2);
        ctx.fill();
        // Рама окна
        ctx.strokeStyle = '#5a3a1a';
        ctx.lineWidth = 3;
        ctx.strokeRect(wx, 60, 120, 100);
        ctx.beginPath();
        ctx.moveTo(wx + 60, 60);
        ctx.lineTo(wx + 60, 160);
        ctx.moveTo(wx, 110);
        ctx.lineTo(wx + 120, 110);
        ctx.stroke();
        // Дождь по стеклу
        ctx.strokeStyle = 'rgba(150, 200, 255, 0.5)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
            const rx = wx + 8 + (i * 15) % 110;
            const ry = 65 + ((time + i * 20) % 90);
            ctx.beginPath();
            ctx.moveTo(rx, ry);
            ctx.lineTo(rx - 2, ry + 10);
            ctx.stroke();
        }
    } else if (bgType === 'city') {
        // Питер - градиент + силуэты зданий + дождь
        const grad = ctx.createLinearGradient(0, 0, 0, viewHeight);
        grad.addColorStop(0, '#1a1230');
        grad.addColorStop(0.6, '#2a1a4e');
        grad.addColorStop(1, '#4a2a5e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, viewWidth, viewHeight);

        // Звёзды
        for (let i = 0; i < 60; i++) {
            const sx = (i * 137 + camera.x * 0.1) % (viewWidth + 40) - 20;
            const sy = (i * 71) % (viewHeight * 0.5);
            const twinkle = 0.5 + 0.5 * Math.sin(time * 0.05 + i);
            ctx.fillStyle = `rgba(255,255,255,${twinkle})`;
            ctx.fillRect(Math.floor(sx), Math.floor(sy), 1, 1);
        }

        // Луна
        const moonX = viewWidth - 90 - camera.x * 0.05;
        ctx.fillStyle = '#ffffcc';
        ctx.beginPath();
        ctx.arc(moonX, 45, 22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2a1a4e';
        ctx.beginPath();
        ctx.arc(moonX - 7, 42, 20, 0, Math.PI * 2);
        ctx.fill();

        // Дальние здания (параллакс 0.3)
        ctx.fillStyle = '#0f0f2e';
        for (let i = 0; i < 20; i++) {
            const bx = i * 180 - camera.x * 0.3;
            const bh = 80 + (i * 37) % 100;
            ctx.fillRect(bx, GROUND_Y - bh, 100, bh);
            // окна
            ctx.fillStyle = '#3a3a6e';
            for (let wy = GROUND_Y - bh + 10; wy < GROUND_Y - 10; wy += 15) {
                for (let wx = bx + 8; wx < bx + 90; wx += 16) {
                    if ((wx + wy) % 3 !== 0) ctx.fillRect(wx, wy, 6, 8);
                }
            }
            ctx.fillStyle = '#0f0f2e';
        }

        // Ближние здания (параллакс 0.55)
        ctx.fillStyle = '#1a0f2e';
        for (let i = 0; i < 25; i++) {
            const bx = i * 140 - camera.x * 0.55;
            const bh = 120 + (i * 53) % 90;
            ctx.fillRect(bx, GROUND_Y - bh, 90, bh);
            ctx.fillStyle = '#5a5a8e';
            for (let wy = GROUND_Y - bh + 10; wy < GROUND_Y - 10; wy += 18) {
                for (let wx = bx + 10; wx < bx + 80; wx += 20) {
                    const lit = ((wx * 3 + wy + i) % 5) > 2;
                    if (lit) ctx.fillRect(wx, wy, 8, 10);
                }
            }
            ctx.fillStyle = '#1a0f2e';
        }

        // Дождь
        ctx.strokeStyle = 'rgba(150, 200, 255, 0.35)';
        ctx.lineWidth = 1;
        for (const drop of rainDrops) {
            const x = (drop.x + camera.x * 0.5 + time * 2) % (viewWidth + 40) - 20;
            const y = (drop.y + time * 8) % viewHeight;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - 2, y + drop.s * 3);
            ctx.stroke();
        }
    } else if (bgType === 'office') {
        // Офис - гладкий градиент + окна
        const grad = ctx.createLinearGradient(0, 0, 0, viewHeight);
        grad.addColorStop(0, '#0a1a2e');
        grad.addColorStop(1, '#1a2a4e');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, viewWidth, viewHeight);

        // Панорамные окна
        for (let i = 0; i < 10; i++) {
            const wx = i * 200 - camera.x * 0.4;
            ctx.fillStyle = '#3a4a6e';
            ctx.fillRect(wx, 60, 140, 180);
            // Ночной город в окне
            ctx.fillStyle = '#1a2a4e';
            for (let j = 0; j < 8; j++) {
                ctx.fillRect(wx + 10 + j * 15, 180, 10, 40);
            }
            // Полоски огней
            ctx.fillStyle = '#ffcc55';
            for (let j = 0; j < 8; j++) {
                for (let k = 0; k < 3; k++) {
                    if ((i + j + k) % 2) ctx.fillRect(wx + 15 + j * 15, 190 + k * 10, 3, 3);
                }
            }
            // Рама
            ctx.strokeStyle = '#5a6a8e';
            ctx.lineWidth = 2;
            ctx.strokeRect(wx, 60, 140, 180);
        }
    }

    // Виньетка
    const vig = ctx.createRadialGradient(viewWidth/2, viewHeight/2, viewHeight * 0.4,
                                          viewWidth/2, viewHeight/2, viewHeight * 0.9);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, viewWidth, viewHeight);
}

function drawPlatform(p) {
    const x = Math.floor(p.x - camera.x);
    const y = Math.floor(p.y);
    if (x + p.w < 0 || x > viewWidth) return;

    // Земля/пол
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(x, y, p.w, p.h);
    ctx.fillStyle = '#5a7a3a';
    ctx.fillRect(x, y, p.w, 5);
    ctx.fillStyle = '#7a9a4a';
    ctx.fillRect(x, y, p.w, 2);

    // Текстура
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 0; i < p.w / 16; i++) {
        ctx.fillRect(x + i * 16 + 4, y + 12, 3, 3);
        ctx.fillRect(x + i * 16 + 10, y + 22, 3, 3);
    }
}

function drawObject(obj) {
    const x = Math.floor(obj.x - camera.x);
    const y = Math.floor(obj.y);
    if (x + obj.w < 0 || x > viewWidth) return;

    const bob = Math.sin(time * 0.05 + obj.x * 0.1) * 2;

    // Тень
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(x + obj.w / 2, y + obj.h + 2, obj.w / 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    if (obj.type === 'computer') {
        // Стол
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(x - 4, y + 28, obj.w + 8, 12);
        // Ноутбук
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(x, y + 6, obj.w, 24);
        // Экран
        ctx.fillStyle = '#1a4a1a';
        ctx.fillRect(x + 3, y + 9, obj.w - 6, 18);
        // Код на экране
        ctx.fillStyle = '#7aff7a';
        for (let i = 0; i < 5; i++) {
            ctx.fillRect(x + 5, y + 11 + i * 3, 6 + (i * 3) % 10, 1);
        }
    } else if (obj.type === 'poster') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(x, y + 8, obj.w, obj.h - 8);
        ctx.fillStyle = '#000';
        ctx.fillRect(x + 3, y + 11, obj.w - 6, obj.h - 14);
        // График
        ctx.strokeStyle = '#7aff7a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 5, y + obj.h - 8);
        for (let i = 0; i < 8; i++) {
            ctx.lineTo(x + 5 + i * (obj.w - 10) / 7,
                       y + obj.h - 8 - (i * 4 + (i % 2 ? 8 : 0)));
        }
        ctx.stroke();
        // Биткоин символ
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 12px monospace';
        ctx.fillText('₿', x + obj.w - 14, y + 20);
    } else if (obj.type === 'door') {
        // Дверь
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(x, y, obj.w, obj.h);
        ctx.fillStyle = '#3a2a10';
        ctx.fillRect(x + 3, y + 3, obj.w - 6, obj.h - 6);
        // Ручка
        ctx.fillStyle = '#ffcc55';
        ctx.fillRect(x + obj.w - 8, y + obj.h / 2 - 2, 3, 4);
        // Табличка
        if (obj.name.includes('выход') || obj.name.includes('Выход') || obj.name.includes('улицу')) {
            ctx.fillStyle = '#7aff7a';
            ctx.fillRect(x + 6, y + 8, obj.w - 12, 3);
        }
    } else if (obj.type === 'npc') {
        // NPC - человечки с иконкой над головой
        const cx = x + obj.w / 2;
        // Тело
        ctx.fillStyle = obj.name.includes('музыкант') ? '#cd5a7a' :
                        obj.name.includes('Инвестор') ? '#2a4a7a' :
                        obj.name.includes('трейдер') ? '#cd8a2a' :
                        obj.name.includes('Партнёр') ? '#3a8a4a' : '#6a3a8a';
        ctx.fillRect(cx - 8, y + 18, 16, 30);
        // Голова
        ctx.fillStyle = '#e0b080';
        ctx.fillRect(cx - 7, y + 8, 14, 12);
        // Глаза
        ctx.fillStyle = '#000';
        ctx.fillRect(cx - 4, y + 13, 2, 2);
        ctx.fillRect(cx + 2, y + 13, 2, 2);
        // Ноги
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(cx - 7, y + 48, 6, 10);
        ctx.fillRect(cx + 1, y + 48, 6, 10);
        // Иконка над головой с покачиванием
        ctx.font = '16px serif';
        ctx.textAlign = 'center';
        ctx.fillText(obj.name.split(' ')[0], cx, y - 5 + bob);
        ctx.textAlign = 'left';
    }
}

function drawPlayer() {
    const x = Math.floor(player.x - camera.x);
    const y = Math.floor(player.y);
    if (x + player.w < 0 || x > viewWidth) return;

    if (player.invulnTimer > 0 && Math.floor(player.invulnTimer / 3) % 2 === 0) return;

    const bob = player.walkFrame === 1 ? 1 : 0;
    const cx = x + player.w / 2;

    // Тень
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(cx, y + player.h + 2, 12, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ноги
    ctx.fillStyle = '#2a3a5a';
    if (player.walkFrame === 1) {
        ctx.fillRect(x + 4, y + 24, 6, 8);
        ctx.fillRect(x + 13, y + 22, 6, 10);
    } else {
        ctx.fillRect(x + 4, y + 22, 6, 10);
        ctx.fillRect(x + 13, y + 24, 6, 8);
    }

    // Тело
    ctx.fillStyle = '#5a7acd';
    ctx.fillRect(x + 3, y + 10 + bob, 17, 14);

    // Руки
    ctx.fillStyle = '#e0b080';
    ctx.fillRect(x + 1, y + 12 + bob, 3, 8);
    ctx.fillRect(x + 19, y + 12 + bob, 3, 8);

    // Голова
    ctx.fillStyle = '#e0b080';
    ctx.fillRect(x + 5, y + 2 + bob, 13, 10);

    // Волосы
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(x + 4, y + 1 + bob, 15, 4);
    ctx.fillRect(x + 4, y + 2 + bob, 2, 4);

    // Глаза по направлению
    ctx.fillStyle = '#000';
    if (player.facing > 0) {
        ctx.fillRect(x + 13, y + 6 + bob, 2, 2);
    } else {
        ctx.fillRect(x + 9, y + 6 + bob, 2, 2);
    }

    // Анимация действия - всплеск
    if (player.actionTimer > 0) {
        const p = 1 - player.actionTimer / 20;
        ctx.strokeStyle = `rgba(255, 255, 100, ${1 - p})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, y + 10, 10 + p * 25, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function drawWeather() {
    if (world.bgType === 'city' || world.bgType === 'office') {
        // Дополнительный эффект - капли на экране
        ctx.fillStyle = 'rgba(150, 200, 255, 0.15)';
        for (let i = 0; i < 5; i++) {
            const x = (i * 137 + time * 0.5) % viewWidth;
            const y = (i * 211 + time * 2) % viewHeight;
            ctx.fillRect(x, y, 1, 3);
        }
    }
}

function render() {
    ctx.clearRect(0, 0, viewWidth, viewHeight);
    drawBackground();
    for (const p of world.platforms) drawPlatform(p);
    for (const obj of world.objects) drawObject(obj);
    drawPlayer();
    drawWeather();
}

// ================= ГЛАВНЫЙ ЦИКЛ =================
let lastTime = performance.now();
let accumulator = 0;
const STEP = 1000 / 60;

function loop(now) {
    const delta = Math.min(now - lastTime, 100);
    lastTime = now;
    accumulator += delta;
    time += delta / 16;

    while (accumulator >= STEP) {
        if (state.phase === 'game' || state.phase === 'chapter') update(delta);
        accumulator -= STEP;
    }

    render();
    requestAnimationFrame(loop);
}

// ================= СТАРТ =================
function init() {
    resize();
    updateHUD();
    locationEl.textContent = world.name;
    requestAnimationFrame(loop);
}

init();
