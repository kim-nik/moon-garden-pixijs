type Cue = 'select' | 'match' | 'special' | 'win' | 'lose' | 'invalid' | 'restore';

export class GardenAudio {
  enabled = true;
  private context: AudioContext | null = null;

  play(cue: Cue, cascade = 1): void {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext();
      const context = this.context;
      void context.resume();
      const notes: Record<Cue, number[]> = {
        select: [440], match: [523, 659], special: [392, 523, 784],
        win: [523, 659, 784, 1047], lose: [392, 330, 262],
        invalid: [196], restore: [440, 554, 659, 880],
      };
      notes[cue].forEach((frequency, i) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = context.currentTime + i * 0.085;
        oscillator.type = 'sine';
        oscillator.frequency.value = frequency * (cue === 'match' ? 1 + Math.min(cascade - 1, 6) * 0.08 : 1);
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.045, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.32);
      });
    } catch {
      // Audio is optional when the browser or device cannot provide a context.
    }
  }
}
