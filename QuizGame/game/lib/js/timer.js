/*
 * Copyright 2026 by Florian Lohkamp
 * Lizenz: GNU GPL v3, siehe LIZENZ_DE_GNU_GPL_v3.md im Projektordner
 */
// Timer Module – 60 second countdown
class GameTimer {
  constructor(displayElement) {
    this.displayElement = displayElement;
    this.duration = 60;
    this.remaining = 0;
    this.intervalId = null;
    this.onTick = null;
    this.onExpired = null;
    this.running = false;
  }

  start(duration) {
    this.stop();
    this.duration = duration || 60;
    this.remaining = this.duration;
    this.running = true;
    this.updateDisplay();

    this.intervalId = setInterval(() => {
      this.remaining--;
      this.updateDisplay();

      if (this.remaining <= 10 && this.remaining > 0) {
        this.playWarning();
      }

      if (this.onTick) {
        this.onTick(this.remaining);
      }

      if (this.remaining <= 0) {
        this.stop();
        this.displayElement.classList.remove('timer-green', 'timer-yellow', 'timer-red');
        this.displayElement.classList.add('timer-expired');
        if (this.onExpired) {
          this.onExpired();
        }
      }
    }, 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
  }

  reset() {
    this.stop();
    this.remaining = this.duration;
    this.displayElement.textContent = this.formatTime(this.duration);
    this.displayElement.classList.remove('timer-green', 'timer-yellow', 'timer-red', 'timer-expired');
  }

  updateDisplay() {
    this.displayElement.textContent = this.formatTime(this.remaining);
    this.displayElement.classList.remove('timer-green', 'timer-yellow', 'timer-red', 'timer-expired');

    if (this.remaining > 30) {
      this.displayElement.classList.add('timer-green');
    } else if (this.remaining > 10) {
      this.displayElement.classList.add('timer-yellow');
    } else {
      this.displayElement.classList.add('timer-red');
    }
  }

  formatTime(seconds) {
    const m = Math.floor(Math.max(0, seconds) / 60);
    const s = Math.max(0, seconds) % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  playWarning() {
    try {
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
      // Short beep using AudioContext
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 800;
      gain.gain.value = 0.1;
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {
      // Audio not available
    }
  }
}
