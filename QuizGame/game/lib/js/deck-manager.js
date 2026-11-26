/*
 * Copyright 2026 by Florian Lohkamp
 * Lizenz: GNU GPL v3, siehe LIZENZ_DE_GNU_GPL_v3.md im Projektordner
 */
// Deck-Verwaltung: API-Zugriff und Validierung
const DeckManager = {
  apiUrl: './api/decks',
  defaultPointValues: [200, 400, 600, 800, 1000],
  maxCategories: 6,

  async list() {
    const resp = await fetch(this.apiUrl, { cache: 'no-store' });
    if (!resp.ok) throw new Error('Deck-Liste konnte nicht geladen werden');
    return resp.json();
  },

  async load(file) {
    const resp = await fetch(`./data/decks/${encodeURIComponent(file)}`, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`Deck "${file}" nicht gefunden`);
    return resp.json();
  },

  async save(file, data) {
    const resp = await fetch(`${this.apiUrl}/${encodeURIComponent(file)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!resp.ok) throw new Error(await this.readError(resp));
  },

  async remove(file) {
    const resp = await fetch(`${this.apiUrl}/${encodeURIComponent(file)}`, { method: 'DELETE' });
    if (!resp.ok) throw new Error(await this.readError(resp));
  },

  async readError(resp) {
    try {
      const body = await resp.json();
      return body.error || `HTTP ${resp.status}`;
    } catch (e) {
      return `HTTP ${resp.status}`;
    }
  },

  fileNameFor(deckId) {
    return `${deckId}.json`;
  },

  isValidDeckId(id) {
    return /^[a-z0-9_-]+$/.test(id);
  },

  // Gibt eine Liste von Fehlermeldungen zurück; leer bedeutet gültig
  validate(data) {
    const errors = [];
    const quiz = data && data.quiz;
    if (!quiz || typeof quiz !== 'object') return ['Das Feld "quiz" fehlt'];

    if (!isFilled(quiz.title)) errors.push('Titel fehlt');
    if (!isFilled(quiz.id)) errors.push('ID fehlt');

    const pv = quiz.pointValues;
    const pvValid = Array.isArray(pv) && pv.length === 5 &&
      pv.every(v => Number.isInteger(v) && v > 0) && new Set(pv).size === 5;
    if (!pvValid) errors.push('Genau 5 verschiedene positive ganzzahlige Punktwerte nötig');

    if (!Array.isArray(quiz.categories) || quiz.categories.length === 0) {
      errors.push('Mindestens eine Kategorie nötig');
      return errors;
    }
    if (quiz.categories.length > this.maxCategories) {
      errors.push(`Maximal ${this.maxCategories} Kategorien erlaubt`);
    }

    const usedIds = new Set();
    const registerId = (id, label) => {
      if (!isFilled(id)) {
        errors.push(`${label}: ID fehlt`);
      } else if (usedIds.has(id)) {
        errors.push(`${label}: ID "${id}" ist doppelt vergeben`);
      } else {
        usedIds.add(id);
      }
    };

    quiz.categories.forEach((cat, ci) => {
      const catLabel = `Kategorie ${isFilled(cat.name) ? `"${cat.name}"` : ci + 1}`;
      if (!isFilled(cat.name)) errors.push(`${catLabel}: Name fehlt`);
      registerId(cat.id, catLabel);

      const questions = Array.isArray(cat.questions) ? cat.questions : [];
      if (questions.length !== 5) {
        errors.push(`${catLabel}: 5 Fragen nötig (aktuell ${questions.length})`);
      }

      if (pvValid) {
        const sortedValues = questions.map(q => q.value).sort((a, b) => a - b);
        const sortedPoints = [...pv].sort((a, b) => a - b);
        if (JSON.stringify(sortedValues) !== JSON.stringify(sortedPoints)) {
          errors.push(`${catLabel}: Punktwerte passen nicht zu den Deck-Punktwerten`);
        }
      }

      questions.forEach((q, qi) => {
        const qLabel = `${catLabel}, Frage ${qi + 1}`;
        registerId(q.id, qLabel);
        if (!isFilled(q.question)) errors.push(`${qLabel}: Fragetext fehlt`);
        if (!isFilled(q.answer)) errors.push(`${qLabel}: Antwort fehlt`);
      });
    });

    return errors;
  }
};

function isFilled(value) {
  return typeof value === 'string' && value.trim() !== '';
}
