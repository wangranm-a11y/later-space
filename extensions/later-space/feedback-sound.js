(() => {
const SOUND_KEY = "laterSpaceSoundEnabled";
let audioContext = null;

async function laterSpaceSoundEnabled() {
  try {
    const stored = await chrome.storage.local.get({ [SOUND_KEY]: true });
    return stored[SOUND_KEY] !== false;
  } catch {
    return true;
  }
}

function prepareLaterSpaceSuccessSound() {
  try {
    const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Context) return null;
    audioContext ||= new Context();
    if (audioContext.state === "suspended") audioContext.resume().catch(() => {});
    return audioContext;
  } catch {
    return null;
  }
}

async function playLaterSpaceSuccessSound(state) {
  if (!(state === "saved" || state === "duplicate") || !(await laterSpaceSoundEnabled())) return false;
  const context = prepareLaterSpaceSuccessSound();
  if (!context) return false;
  try {
    const startedAt = context.currentTime + .008;
    const gain = context.createGain();
    gain.gain.setValueAtTime(.0001, startedAt);
    gain.gain.exponentialRampToValueAtTime(.055, startedAt + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, startedAt + .17);
    gain.connect(context.destination);
    [[620, 0], [820, .065]].forEach(([frequency, offset]) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, startedAt + offset);
      oscillator.connect(gain);
      oscillator.start(startedAt + offset);
      oscillator.stop(startedAt + offset + .1);
    });
    return true;
  } catch {
    return false;
  }
}

globalThis.laterSpaceSound = {
  key: SOUND_KEY,
  enabled: laterSpaceSoundEnabled,
  prepare: prepareLaterSpaceSuccessSound,
  play: playLaterSpaceSuccessSound,
};
})();
