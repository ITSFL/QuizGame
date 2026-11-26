/*
 * Copyright 2026 by Florian Lohkamp
 * Lizenz: GNU GPL v3, siehe LIZENZ_DE_GNU_GPL_v3.md im Projektordner
 */
// Admin-Bereich: Deck-Übersicht, Deck-Editor, Import/Export
let adminEditFile = null;   // Dateiname des bearbeiteten Decks, null bei neuem Deck
let editorDraft = null;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('adminNewDeckBtn').addEventListener('click', () => openEditor(null));
  document.getElementById('adminImportBtn').addEventListener('click', () => {
    document.getElementById('adminImportInput').click();
  });
  document.getElementById('adminImportInput').addEventListener('change', importDeckFile);

  document.getElementById('editorAddCategoryBtn').addEventListener('click', () => {
    if (editorDraft.categories.length >= DeckManager.maxCategories) return;
    syncDraftAndRender(draft => draft.categories.push(newCategory()));
  });
  // Änderungen an Punktwerten wirken auf die Fragen-Labels
  document.getElementById('editorPointValues').addEventListener('change', () => syncDraftAndRender());
  document.getElementById('editorDeckId').addEventListener('input', event => {
    event.target.value = event.target.value.toLowerCase();
  });
  document.getElementById('editorSaveBtn').addEventListener('click', saveDeck);
  document.getElementById('editorCancelBtn').addEventListener('click', showAdminDashboard);
});

// --- Dashboard ---

async function showAdminDashboard() {
  showScreen('screen-admin');
  document.getElementById('adminMessage').replaceChildren();
  await renderDeckList();
}

async function renderDeckList() {
  const container = document.getElementById('deckList');
  container.replaceChildren(makeEl('p', 'text-center text-secondary', 'Lade Decks …'));
  try {
    const decks = await DeckManager.list();
    if (decks.length === 0) {
      container.replaceChildren(makeEl('p', 'text-center text-secondary', 'Keine Decks vorhanden.'));
      return;
    }
    const list = makeEl('div', 'list-group');
    decks.forEach(deck => list.appendChild(createDeckItem(deck)));
    container.replaceChildren(list);
  } catch (e) {
    renderAlert(container, 'danger', 'Deck-Liste konnte nicht geladen werden. Bitte den Server über die start-server-Skripte starten.', [e.message]);
  }
}

function createDeckItem(deck) {
  const item = makeEl('div', 'list-group-item bg-dark text-light d-flex flex-wrap justify-content-between align-items-center gap-2');

  const info = makeEl('div');
  const title = deck.protected ? `${deck.title} (Standard)` : deck.title;
  info.append(makeEl('div', 'fw-bold', title), makeEl('small', 'text-secondary', deck.file));

  const actions = makeEl('div', 'd-flex gap-2');
  const deleteBtn = actionButton('Löschen', 'btn-danger', () => deleteDeck(deck));
  deleteBtn.disabled = deck.protected;
  actions.append(
    actionButton('Bearbeiten', 'btn-primary', () => openEditor(deck.file)),
    actionButton('Exportieren', 'btn-secondary', () => exportDeck(deck.file)),
    deleteBtn
  );

  item.append(info, actions);
  return item;
}

function actionButton(label, className, onClick) {
  const button = makeEl('button', `btn btn-sm ${className}`, label);
  button.type = 'button';
  button.addEventListener('click', onClick);
  return button;
}

async function deleteDeck(deck) {
  if (!window.confirm(`Deck "${deck.title}" wirklich löschen?`)) return;
  try {
    await DeckManager.remove(deck.file);
    await renderDeckList();
    renderAlert(document.getElementById('adminMessage'), 'success', `Deck "${deck.title}" gelöscht.`);
  } catch (e) {
    renderAlert(document.getElementById('adminMessage'), 'danger', 'Löschen fehlgeschlagen:', [e.message]);
  }
}

async function exportDeck(file) {
  try {
    const data = await DeckManager.load(file);
    downloadJson(file, data);
  } catch (e) {
    renderAlert(document.getElementById('adminMessage'), 'danger', 'Export fehlgeschlagen:', [e.message]);
  }
}

function downloadJson(fileName, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = makeEl('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

async function importDeckFile(event) {
  const input = event.target;
  const file = input.files[0];
  input.value = ''; // gleiche Datei erneut wählbar machen
  if (!file) return;

  const message = document.getElementById('adminMessage');
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch (e) {
    renderAlert(message, 'danger', 'Datei ist kein gültiges JSON.');
    return;
  }

  const errors = DeckManager.validate(data);
  if (errors.length > 0) {
    renderAlert(message, 'danger', 'Import abgelehnt:', errors);
    return;
  }
  if (!DeckManager.isValidDeckId(data.quiz.id)) {
    renderAlert(message, 'danger', 'Import abgelehnt:', ['ID darf nur a-z, 0-9, _ und - enthalten']);
    return;
  }

  const fileName = DeckManager.fileNameFor(data.quiz.id);
  try {
    const decks = await DeckManager.list();
    if (decks.some(deck => deck.file === fileName) &&
        !window.confirm(`Deck "${fileName}" existiert bereits und wird überschrieben. Fortfahren?`)) {
      return;
    }
    await DeckManager.save(fileName, data);
    await renderDeckList();
    renderAlert(message, 'success', `Deck "${data.quiz.title}" importiert.`);
  } catch (e) {
    renderAlert(message, 'danger', 'Import fehlgeschlagen:', [e.message]);
  }
}

// --- Deck-Editor ---

async function openEditor(file) {
  try {
    const data = file ? await DeckManager.load(file) : null;
    editorDraft = data ? draftFromQuiz(data.quiz) : {
      id: '',
      title: '',
      pointValues: [...DeckManager.defaultPointValues],
      categories: []
    };
  } catch (e) {
    renderAlert(document.getElementById('adminMessage'), 'danger', 'Deck konnte nicht geladen werden:', [e.message]);
    return;
  }

  adminEditFile = file;
  document.getElementById('editorErrors').replaceChildren();
  showScreen('screen-deck-editor');
  renderEditor();
}

function draftFromQuiz(quiz) {
  const pointValues = Array.isArray(quiz.pointValues)
    ? [...quiz.pointValues]
    : [...DeckManager.defaultPointValues];
  return {
    id: quiz.id || '',
    title: quiz.title || '',
    pointValues,
    categories: (quiz.categories || []).map(cat => ({
      id: cat.id || newCategoryId(),
      name: cat.name || '',
      questions: pointValues.map(value => {
        const q = (cat.questions || []).find(item => item.value === value) || {};
        return { question: q.question || '', answer: q.answer || '', isRisk: q.isRisk === true };
      })
    }))
  };
}

function newCategory() {
  return {
    id: newCategoryId(),
    name: '',
    questions: DeckManager.defaultPointValues.map(() => ({ question: '', answer: '', isRisk: false }))
  };
}

function newCategoryId() {
  return `cat_${Math.random().toString(36).slice(2, 8)}`;
}

// Liest den DOM-Stand in den Entwurf, führt die Änderung aus und rendert neu
function syncDraftAndRender(mutate = () => {}) {
  readEditorIntoDraft();
  mutate(editorDraft);
  renderEditor();
}

function readEditorIntoDraft() {
  editorDraft.id = document.getElementById('editorDeckId').value.trim().toLowerCase();
  editorDraft.title = document.getElementById('editorDeckTitle').value.trim();
  editorDraft.pointValues = [...document.querySelectorAll('.editor-point')]
    .map(input => parseInt(input.value, 10));
  editorDraft.categories = [...document.querySelectorAll('.editor-category')].map(card => ({
    id: card.dataset.categoryId,
    name: card.querySelector('.editor-category-name').value.trim(),
    questions: [...card.querySelectorAll('.editor-question')].map(row => ({
      question: row.querySelector('.editor-question-text').value.trim(),
      answer: row.querySelector('.editor-answer-text').value.trim(),
      isRisk: row.querySelector('.editor-risk').checked
    }))
  }));
}

function renderEditor() {
  document.getElementById('editorDeckId').value = editorDraft.id;
  document.getElementById('editorDeckTitle').value = editorDraft.title;

  const pointContainer = document.getElementById('editorPointValues');
  pointContainer.replaceChildren(...editorDraft.pointValues.map(value => {
    const col = makeEl('div', 'col');
    const input = makeEl('input', 'form-control editor-point');
    input.type = 'number';
    input.min = '1';
    input.step = '1';
    input.value = Number.isNaN(value) ? '' : value;
    col.appendChild(input);
    return col;
  }));

  const categoryContainer = document.getElementById('editorCategories');
  categoryContainer.replaceChildren(...editorDraft.categories.map(renderCategoryCard));
  document.getElementById('editorAddCategoryBtn').disabled =
    editorDraft.categories.length >= DeckManager.maxCategories;
}

function renderCategoryCard(cat, index) {
  const card = makeEl('div', 'card bg-secondary text-light mb-3 editor-category');
  card.dataset.categoryId = cat.id;

  const header = makeEl('div', 'card-header d-flex gap-2 align-items-center');
  const nameInput = makeEl('input', 'form-control editor-category-name');
  nameInput.type = 'text';
  nameInput.placeholder = 'Kategorie-Name';
  nameInput.value = cat.name;
  const removeBtn = actionButton('Kategorie löschen', 'btn-outline-danger text-nowrap',
    () => syncDraftAndRender(draft => draft.categories.splice(index, 1)));
  header.append(nameInput, removeBtn);

  const body = makeEl('div', 'card-body');
  cat.questions.forEach((q, qi) => body.appendChild(renderQuestionRow(q, editorDraft.pointValues[qi])));

  card.append(header, body);
  return card;
}

function renderQuestionRow(q, value) {
  const row = makeEl('div', 'editor-question border-bottom border-secondary pb-3 mb-3');

  const head = makeEl('div', 'd-flex justify-content-between align-items-center mb-2');
  const riskInput = makeEl('input', 'form-check-input editor-risk me-2');
  riskInput.type = 'checkbox';
  riskInput.checked = q.isRisk;
  const riskLabel = makeEl('label', 'form-check-label');
  riskLabel.append(riskInput, '⚠️ Risiko-Frage');
  const riskWrap = makeEl('div', 'form-check mb-0');
  riskWrap.appendChild(riskLabel);
  head.append(makeEl('strong', '', `${value} Punkte`), riskWrap);

  const questionInput = makeEl('textarea', 'form-control editor-question-text mb-2');
  questionInput.rows = 2;
  questionInput.placeholder = 'Fragetext';
  questionInput.value = q.question;

  const answerInput = makeEl('textarea', 'form-control editor-answer-text');
  answerInput.rows = 2;
  answerInput.placeholder = 'Antwort';
  answerInput.value = q.answer;

  row.append(head, questionInput, answerInput);
  return row;
}

async function saveDeck() {
  readEditorIntoDraft();
  const quiz = buildQuiz(editorDraft);
  const errorContainer = document.getElementById('editorErrors');

  const errors = DeckManager.validate({ quiz });
  if (!adminEditFile && quiz.id && !DeckManager.isValidDeckId(quiz.id)) {
    errors.push('ID darf nur a-z, 0-9, _ und - enthalten');
  }
  if (errors.length > 0) {
    renderAlert(errorContainer, 'danger', 'Speichern nicht möglich:', errors);
    window.scrollTo(0, 0);
    return;
  }

  const file = adminEditFile || DeckManager.fileNameFor(quiz.id);
  try {
    if (!adminEditFile) {
      const decks = await DeckManager.list();
      if (decks.some(deck => deck.file === file)) {
        renderAlert(errorContainer, 'danger', `Ein Deck mit der ID "${quiz.id}" existiert bereits.`);
        return;
      }
    }
    await DeckManager.save(file, { quiz });
    await showAdminDashboard();
    renderAlert(document.getElementById('adminMessage'), 'success', `Deck "${quiz.title}" gespeichert.`);
  } catch (e) {
    renderAlert(errorContainer, 'danger', 'Speichern fehlgeschlagen:', [e.message]);
  }
}

function buildQuiz(draft) {
  return {
    id: draft.id,
    title: draft.title,
    pointValues: draft.pointValues,
    categories: draft.categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      questions: cat.questions.map((q, i) => ({
        id: `${cat.id}_${draft.pointValues[i]}`,
        value: draft.pointValues[i],
        question: q.question,
        answer: q.answer,
        isRisk: q.isRisk
      }))
    }))
  };
}

// --- Hilfsfunktionen ---

function makeEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderAlert(container, type, title, messages = []) {
  const alert = makeEl('div', `alert alert-${type}`);
  alert.appendChild(makeEl('div', 'fw-bold', title));
  if (messages.length > 0) {
    const list = makeEl('ul', 'mb-0 mt-1');
    messages.forEach(message => list.appendChild(makeEl('li', '', message)));
    alert.appendChild(list);
  }
  container.replaceChildren(alert);
}
