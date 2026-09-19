// ================= АУДИО ДВИЖОК =================
// Процедурная музыка и звуки через Web Audio API

const AudioSys = (() => {
    let ctx = null;
    let masterGain = null, musicGain = null, sfxGain = null;
    let musicTimer = null;
    let currentTrack = null;
    let muted = false;
    let musicPlaying = false;

    function init() {
        if (ctx) return;
        try {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = ctx.createGain();
            masterGain.gain.value = 0.6;
            masterGain.connect(ctx.destination);
            musicGain = ctx.createGain();
            musicGain.gain.value = 0.22;
            musicGain.connect(masterGain);
            sfxGain = ctx.createGain();
            sfxGain.gain.value = 0.45;
            sfxGain.connect(masterGain);
        } catch (e) { console.warn('Audio unavailable', e); }
    }

    function resume() {
        if (ctx && ctx.state === 'suspended') ctx.resume();
    }

    function tone({ freq = 440, type = 'sine', dur = 0.2, vol = 0.3, target = null, detune = 0 }) {
        if (!ctx || muted) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.detune.value = detune;
        const t = ctx.currentTime;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.connect(gain);
        gain.connect(target || sfxGain);
        osc.start(t);
        osc.stop(t + dur + 0.05);
    }

    function noise({ dur = 0.1, vol = 0.2, freq = 1000, target = null }) {
        if (!ctx || muted) return;
        const size = Math.floor(ctx.sampleRate * dur);
        const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = freq;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(target || sfxGain);
        src.start();
    }

    // Эффекты
    const sfx = {
        step:    () => noise({ dur: 0.05, vol: 0.08, freq: 350 }),
        coin:    () => { tone({ freq: 1200, type: 'square', dur: 0.08, vol: 0.15 });
                         setTimeout(() => tone({ freq: 1800, type: 'square', dur: 0.12, vol: 0.15 }), 50); },
        interact:() => { tone({ freq: 600, type: 'triangle', dur: 0.1, vol: 0.2 });
                         setTimeout(() => tone({ freq: 900, type: 'triangle', dur: 0.15, vol: 0.2 }), 80); },
        success: () => [523, 659, 784, 1047].forEach((f, i) =>
                        setTimeout(() => tone({ freq: f, type: 'square', dur: 0.12, vol: 0.18 }), i * 90)),
        fail:    () => { tone({ freq: 300, type: 'sawtooth', dur: 0.15, vol: 0.18 });
                         setTimeout(() => tone({ freq: 200, type: 'sawtooth', dur: 0.25, vol: 0.18 }), 120); },
        type:    () => noise({ dur: 0.015, vol: 0.03, freq: 4000 }),
        click:   () => tone({ freq: 800, type: 'square', dur: 0.05, vol: 0.12 }),
        scene:   () => tone({ freq: 440, type: 'sine', dur: 0.35, vol: 0.12 }),
        chapter: () => [262, 330, 392, 523].forEach((f, i) =>
                        setTimeout(() => tone({ freq: f, type: 'triangle', dur: 0.3, vol: 0.2 }), i * 150)),
        win:     () => [523, 659, 784, 1047, 1319, 1047, 1319, 1568].forEach((f, i) =>
                        setTimeout(() => tone({ freq: f, type: 'triangle', dur: 0.25, vol: 0.22 }), i * 130)),
        lose:    () => [400, 350, 300, 250, 200].forEach((f, i) =>
                        setTimeout(() => tone({ freq: f, type: 'sawtooth', dur: 0.3, vol: 0.18 }), i * 180))
    };

    // Мелодии
    const tracks = {
        prologue: {
            tempo: 460,
            notes: [220, 262, 294, 262, 220, 196, 175, 196, 220, 262, 247, 220, 196, 175, 165, 175],
            type: 'triangle', vol: 0.11,
            bass: [110, 110, 98, 98, 87, 87, 98, 98]
        },
        spb: {
            tempo: 340,
            notes: [330, 392, 440, 392, 330, 294, 262, 294, 330, 392, 349, 330, 294, 262, 247, 262],
            type: 'sine', vol: 0.13,
            bass: [165, 147, 131, 147]
        },
        business: {
            tempo: 240,
            notes: [523, 587, 659, 587, 523, 494, 440, 494, 523, 587, 659, 784, 659, 587, 523, 494],
            type: 'square', vol: 0.08,
            bass: [131, 165, 196, 165]
        },
        crypto: {
            tempo: 190,
            notes: [440, 440, 523, 523, 587, 587, 523, 440, 392, 392, 440, 523, 587, 523, 440, 392],
            type: 'sawtooth', vol: 0.06,
            bass: [110, 110, 110, 110, 98, 98, 98, 98]
        },
        victory: {
            tempo: 300,
            notes: [523, 659, 784, 1047, 784, 1047, 1319, 1047, 784, 659, 784, 523, 587, 659, 784, 1047],
            type: 'triangle', vol: 0.12,
            bass: [131, 165, 196, 262]
        },
        danger: {
            tempo: 280,
            notes: [196, 185, 196, 175, 196, 165, 196, 155],
            type: 'sawtooth', vol: 0.09,
            bass: [98, 92, 98, 87]
        },
        cutscene: {
            tempo: 700,
            notes: [262, 330, 294, 349, 330, 294, 262, 220, 262, 330, 294, 349, 392, 349, 330, 294],
            type: 'sine', vol: 0.09,
            bass: [131, 131, 110, 110]
        }
    };

    function playMusic(name) {
        if (!ctx || muted) return;
        if (currentTrack === name && musicPlaying) return;
        stopMusic();
        currentTrack = name;
        musicPlaying = true;
        const track = tracks[name];
        if (!track) return;
        let n = 0, b = 0;
        musicTimer = setInterval(() => {
            if (muted || !musicPlaying) return;
            const f = track.notes[n % track.notes.length];
            tone({ freq: f, type: track.type, dur: track.tempo / 1000 * 0.75, vol: track.vol, target: musicGain });
            if (n % 2 === 0 && track.bass) {
                const bf = track.bass[b % track.bass.length];
                tone({ freq: bf, type: 'sine', dur: track.tempo / 1000, vol: track.vol * 0.8, target: musicGain });
                b++;
            }
            n++;
        }, track.tempo);
    }

    function stopMusic() {
        if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
        musicPlaying = false;
        currentTrack = null;
    }

    function toggleMute() {
        muted = !muted;
        if (masterGain) masterGain.gain.value = muted ? 0 : 0.6;
        return muted;
    }

    return {
        init, resume,
        play: (n) => sfx[n] && sfx[n](),
        playMusic, stopMusic, toggleMute,
        get muted() { return muted; }
    };
})();
