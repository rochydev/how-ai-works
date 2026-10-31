/**
 * The journey of a prompt, in order. `shot` picks the camera framing,
 * `mood` the LED colours, `holo` the 3D hologram above the desk and
 * `duration` how long autoplay lingers (seconds; generation is dynamic).
 */
export const STAGES = [
  { id: 'prompt', shot: 'shoulder', mood: 'typing', holo: null, duration: 0 },
  { id: 'tokens', shot: 'screen', mood: 'thinking', holo: 'tokens', duration: 9 },
  { id: 'ids', shot: 'screen', mood: 'thinking', holo: null, duration: 8 },
  { id: 'embeddings', shot: 'screen', mood: 'thinking', holo: null, duration: 10 },
  { id: 'position', shot: 'screen', mood: 'thinking', holo: null, duration: 9 },
  { id: 'attention', shot: 'holo', mood: 'thinking', holo: 'attention', duration: 13 },
  { id: 'layers', shot: 'holo', mood: 'thinking', holo: 'layers', duration: 10 },
  { id: 'logits', shot: 'screen', mood: 'thinking', holo: null, duration: 10 },
  { id: 'sampling', shot: 'screen', mood: 'thinking', holo: null, duration: 7 },
  { id: 'generate', shot: 'shoulder', mood: 'answer', holo: 'stream', duration: 0 },
  { id: 'answer', shot: 'room', mood: 'idle', holo: null, duration: 0 },
];

export const stageIndex = (id) => STAGES.findIndex((s) => s.id === id);
