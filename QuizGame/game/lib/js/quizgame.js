/*
 * Copyright 2026 by Florian Lohkamp
 * Lizenz: GNU GPL v3, siehe LIZENZ_DE_GNU_GPL_v3.md im Projektordner
 */
// Main QuizGame Controller
// gameState is instantiated after DOM load to avoid redeclaration issues
let gameState;
let boardRenderer;
let gameTimer;
let quizData = null;
let questionModal = null;
let currentQuestion = null;
let currentCategory = null;
let questionStartTeamIndex = 0;
let scoreboardChannel = null;
let quizmasterChannel = null;
let activeQuestionMessage = null;

// --- Deck Loading ---

async function loadDeckList() {
  const select = document.getElementById('deckSelect');
  select.innerHTML = '';

  try {
    const decks = await DeckManager.list();
    decks.forEach(deck => {
      const opt = document.createElement('option');
      opt.value = deck.url;
      opt.textContent = deck.title;
      select.appendChild(opt);
    });
  } catch (e) {
    // Server-API nicht erreichbar: Standard-Deck direkt laden
    const opt = document.createElement('option');
    opt.value = './data/questions.json';
    opt.textContent = 'Standard-Deck';
    select.appendChild(opt);
  }
}

async function loadSelectedDeck() {
  const url = document.getElementById('deckSelect').value;

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error('Deck nicht gefunden');
  quizData = await response.json();
  gameState.loadQuizData(quizData);
  return quizData;
}

// --- Scoreboard Window ---

function handleScoreboardMessage(event) {
  if (event.data.type === 'hello') {
    document.body.classList.add('scoreboard-open');
    broadcastScoreboardState();
  } else if (event.data.type === 'bye') {
    document.body.classList.remove('scoreboard-open');
  }
}

function broadcastScoreboardState() {
  scoreboardChannel.postMessage({
    type: 'state',
    teams: gameState.teams.map(team => ({ name: team.name, score: team.score })),
    activeIndex: gameState.currentTeamIndex
  });
}

// --- Quizmaster Window ---

function publishQuizmasterState(message) {
  activeQuestionMessage = message.type === 'clear' ? null : message;
  quizmasterChannel.postMessage(message);
}

function handleQuizmasterMessage(event) {
  if (event.data.type === 'hello') {
    quizmasterChannel.postMessage(activeQuestionMessage || { type: 'clear' });
  }
}

// --- Popup Windows ---

function openPopup(event, url, name, size) {
  event.preventDefault();
  window.open(url, name, `${size},menubar=no,toolbar=no`);
}

// --- Screen Management ---

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('d-none'));
  document.getElementById(screenId).classList.remove('d-none');
}

// --- Team Input ---

function setupTeamInput() {
  const teamCountInput = document.getElementById('teamCount');
  const container = document.getElementById('teamNamesContainer');

  const updateNames = () => {
    const count = Math.max(2, Math.min(6, parseInt(teamCountInput.value) || 2));
    teamCountInput.value = count;
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-control mb-2';
      input.placeholder = `Team ${i + 1} Name`;
      input.id = `teamName${i}`;
      container.appendChild(input);
    }
  };

  teamCountInput.addEventListener('change', updateNames);
  teamCountInput.addEventListener('input', updateNames);
  updateNames();
}

// --- Game Start ---

async function startGame() {
  try {
    await loadSelectedDeck();
  } catch (error) {
    alert('Fehler beim Laden des Decks: ' + error.message);
    return;
  }

  const teamCount = parseInt(document.getElementById('teamCount').value);
  const teamNames = [];
  for (let i = 0; i < teamCount; i++) {
    const input = document.getElementById(`teamName${i}`);
    teamNames.push(input ? input.value.trim() || `Team ${i + 1}` : `Team ${i + 1}`);
  }

  gameState.initializeTeams(teamCount, teamNames);
  const startTeam = gameState.randomizeStartTeam();
  showStartTeamAnnouncement(startTeam);
}

function showStartTeamAnnouncement(team) {
  const overlay = document.createElement('div');
  overlay.className = 'position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center';
  overlay.style.cssText = 'z-index:9999; background:rgba(0,0,0,0.8);';
  overlay.innerHTML = `
    <div class="text-center text-light">
      <h1>🎲 Start-Team</h1>
      <h2 class="text-info mt-3">${boardRenderer.escapeHtml(team.name)}</h2>
      <p class="fs-4 mt-2">beginnt das Spiel!</p>
    </div>
  `;
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.remove();
    showBoardScreen();
  }, 2500);
}

function showBoardScreen() {
  showScreen('screen-board');
  const title = quizData.quiz.title || 'QuizGame';
  document.getElementById('boardTitle').textContent = title;
  boardRenderer.renderBoard(quizData, gameState);
  boardRenderer.renderScoreboard(gameState);
  boardRenderer.highlightActiveTeam(gameState);
  broadcastScoreboardState();
}

// --- Question Handling ---

function handleQuestionClick(question, category) {
  if (gameState.isQuestionAnswered(question.id)) return;

  currentQuestion = question;
  currentCategory = category;
  questionStartTeamIndex = gameState.currentTeamIndex;
  openQuestionForCurrentTeam();
}

// Öffnet die aktuelle Frage für das aktive Team (auch nach Weitergabe)
function openQuestionForCurrentTeam() {
  gameState.currentBet = 0;

  // Reset modal state
  document.getElementById('riskPhase').classList.add('d-none');
  document.getElementById('questionPhase').classList.add('d-none');
  document.getElementById('timerActions').classList.remove('d-none');
  document.getElementById('answerPhase').classList.add('d-none');
  document.getElementById('revealPhase').classList.add('d-none');
  document.getElementById('timeoutPhase').classList.add('d-none');
  document.getElementById('timeoutAnswerContainer').classList.add('d-none');
  document.getElementById('riskBetDisplay').classList.add('d-none');

  const team = gameState.getCurrentTeam();
  document.getElementById('modalTitle').textContent =
    `${currentCategory.name} – ${currentQuestion.value} Punkte (${team.name})`;

  gameTimer.reset();

  if (currentQuestion.isRisk) {
    showRiskPhase(currentQuestion, team);
  } else {
    showQuestionPhase(currentQuestion);
  }

  questionModal.show();
}

function showRiskPhase(question, team) {
  document.getElementById('riskPhase').classList.remove('d-none');
  document.getElementById('riskTeamName').textContent = team.name;
  document.getElementById('riskTeamScore').textContent = team.score;
  document.getElementById('riskBetInput').max = Math.max(0, team.score);
  document.getElementById('riskBetInput').value = 0;
  document.getElementById('riskBetError').classList.add('d-none');
}

function confirmBet() {
  const team = gameState.getCurrentTeam();
  const betInput = document.getElementById('riskBetInput');
  const bet = parseInt(betInput.value) || 0;
  const maxBet = Math.max(0, team.score);

  if (bet < 0 || bet > maxBet) {
    document.getElementById('riskBetError').classList.remove('d-none');
    document.getElementById('riskBetError').textContent =
      `Einsatz muss zwischen 0 und ${maxBet} liegen!`;
    return;
  }

  gameState.currentBet = bet;
  document.getElementById('riskPhase').classList.add('d-none');
  document.getElementById('riskBetDisplay').classList.remove('d-none');
  document.getElementById('riskBetDisplay').textContent =
    `⚠️ Risiko-Einsatz: ${bet} Punkte`;

  showQuestionPhase(currentQuestion);
}

function showQuestionPhase(question) {
  document.getElementById('questionPhase').classList.remove('d-none');
  document.getElementById('questionText').textContent = question.question;
  document.getElementById('answerText').textContent = question.answer;
  document.getElementById('timeoutAnswerText').textContent = question.answer;

  // Start timer automatically
  gameTimer.start(60);

  const team = gameState.getCurrentTeam();
  publishQuizmasterState({
    type: 'question',
    category: currentCategory.name,
    value: question.value,
    team: team.name,
    isRisk: question.isRisk,
    bet: question.isRisk ? gameState.currentBet : 0,
    question: question.question,
    answer: question.answer
  });
}

// --- Timer Events ---

function onTimerExpired() {
  document.getElementById('timerActions').classList.add('d-none');
  document.getElementById('answerPhase').classList.add('d-none');
  document.getElementById('timeoutPhase').classList.remove('d-none');
}

function onAnswerGiven() {
  gameTimer.stop();
  document.getElementById('timerActions').classList.add('d-none');
  document.getElementById('answerPhase').classList.remove('d-none');
}

// --- Answer Resolution ---

// Antwort erst zeigen, wenn die Frage endgültig entschieden ist (kein Leak an wartende Teams)
function revealAnswerAndFinish() {
  document.getElementById('answerPhase').classList.add('d-none');
  document.getElementById('answerText').textContent = currentQuestion.answer;
  document.getElementById('revealPhase').classList.remove('d-none');
}

function handleCorrect() {
  if (currentQuestion.isRisk) {
    gameState.awardRiskPoints(currentQuestion.value, gameState.currentBet);
  } else {
    gameState.awardPoints(currentQuestion.value);
  }

  gameState.markQuestionAsAnswered(currentQuestion.id);
  revealAnswerAndFinish();
}

// Falsch: kein Punktabzug, Frage geht an nächstes Team; Auflösung erst, wenn keines mehr übrig ist
function handleWrong() {
  gameState.markTeamAttempted(currentQuestion.id, gameState.getCurrentTeam().id);

  const nextIndex = gameState.findNextAvailableTeamIndex(currentQuestion.id);
  if (nextIndex === -1) {
    gameState.markQuestionAsAnswered(currentQuestion.id);
    revealAnswerAndFinish();
    return;
  }

  gameState.setCurrentTeamIndex(nextIndex);
  openQuestionForCurrentTeam();
}

function showAnswerAfterTimeout() {
  gameState.markQuestionAsAnswered(currentQuestion.id);

  document.getElementById('showAnswerTimeoutBtn').classList.add('d-none');
  document.getElementById('timeoutAnswerContainer').classList.remove('d-none');
}

function finishQuestion() {
  questionModal.hide();
  publishQuizmasterState({ type: 'clear' });
  // Kein Buzzer-System: fester Wechsel nach jeder Frage, unabhängig vom Ergebnis
  gameState.setCurrentTeamIndex((questionStartTeamIndex + 1) % gameState.teams.length);
  afterQuestionClosed();
}

function afterQuestionClosed() {
  gameTimer.stop();
  boardRenderer.updateCellStatus(currentQuestion.id);
  boardRenderer.renderScoreboard(gameState);
  boardRenderer.highlightActiveTeam(gameState);
  broadcastScoreboardState();

  if (gameState.checkGameOver()) {
    showResultsScreen();
  }
}

// --- Results ---

function showResultsScreen() {
  showScreen('screen-result');
  const ranking = gameState.getRanking();
  const resultsList = document.getElementById('resultsList');
  resultsList.innerHTML = '';

  const list = document.createElement('ul');
  list.className = 'results-container';

  ranking.forEach((team, index) => {
    const item = document.createElement('li');
    item.className = 'result-item';
    if (index === 0) item.classList.add('winner');
    item.innerHTML = `
      <span class="result-rank">${index === 0 ? '🏆' : index + 1}</span>
      <span class="result-name">${boardRenderer.escapeHtml(team.name)}</span>
      <span class="result-score">${team.score} Punkte</span>
    `;
    list.appendChild(item);
  });

  resultsList.appendChild(list);
}

// --- Fullscreen ---

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {
      alert('Vollbild wird in diesem Browser nicht unterstützt. Nutze F11.');
    });
  } else {
    document.exitFullscreen();
  }
}

// --- Reset ---

function resetGame() {
  gameTimer.stop();
  if (questionModal) {
    questionModal.hide();
  }
  gameState.reset();
  publishQuizmasterState({ type: 'clear' });
  currentQuestion = null;
  currentCategory = null;
  showScreen('screen-mode');
}

// Laufendes Spiel darf nicht versehentlich ohne Rückfrage beendet werden
function confirmResetGame() {
  if (window.confirm('Laufendes Spiel wirklich beenden und ein neues Spiel starten?')) {
    resetGame();
  }
}

// --- Init ---

// Chrome blockiert fetch() von lokalen Dateien (file://) per CORS-Richtlinie,
// wodurch Kartendecks nicht geladen werden können. Firefox erlaubt dies zwar,
// daher nur dort unbemerkt. Nutzer über einen lokalen Server informieren.
function warnIfFileProtocol() {
  if (location.protocol !== 'file:') return;
  const banner = document.createElement('div');
  banner.className = 'alert alert-warning text-center rounded-0 mb-0';
  banner.style.cssText = 'position:sticky; top:0; z-index:10000;';
  banner.innerHTML = '⚠️ Diese Seite wurde direkt als Datei geöffnet (file://). ' +
    'Chrome blockiert dadurch das Laden der Kartendecks. ' +
    'Bitte über einen lokalen Server öffnen: <code>./start-server.sh</code> (Linux/macOS Terminal), ' +
    '<code>start-server.command</code> (macOS Doppelklick) oder <code>start-server.bat</code> (Windows) ' +
    'ausführen und dann <code>http://localhost:8000</code> im Browser aufrufen.';
  document.body.prepend(banner);
}

document.addEventListener('DOMContentLoaded', async () => {
  warnIfFileProtocol();
  gameState = new GameState();
  boardRenderer = new BoardRenderer();
  gameTimer = new GameTimer(document.getElementById('timerDisplay'));
  questionModal = new bootstrap.Modal(document.getElementById('questionModal'));

  gameTimer.onExpired = onTimerExpired;
  boardRenderer.onQuestionClick = handleQuestionClick;

  await loadDeckList();
  setupTeamInput();

  // Mode selection
  document.getElementById('modeGameBtn').addEventListener('click', async () => {
    await loadDeckList();
    showScreen('screen-start');
  });
  document.getElementById('modeAdminBtn').addEventListener('click', () => {
    showAdminDashboard();
  });
  document.getElementById('backToModeBtn').addEventListener('click', () => {
    showScreen('screen-mode');
  });
  document.getElementById('backToModeFromAdminBtn').addEventListener('click', () => {
    showScreen('screen-mode');
  });

  // Game controls
  document.getElementById('startGameBtn').addEventListener('click', startGame);
  document.getElementById('resetGameBtn').addEventListener('click', confirmResetGame);
  document.getElementById('newGameBtn').addEventListener('click', resetGame);
  document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);

  // Scoreboard and quizmaster windows
  scoreboardChannel = new BroadcastChannel('quizgame-scoreboard');
  scoreboardChannel.onmessage = handleScoreboardMessage;
  quizmasterChannel = new BroadcastChannel('quizgame-quizmaster');
  quizmasterChannel.onmessage = handleQuizmasterMessage;

  const scoreboardWindow = ['./scoreboard.html', 'quizgame-scoreboard', 'width=600,height=400'];
  const quizmasterWindow = ['./quizmaster.html', 'quizgame-quizmaster', 'width=800,height=600'];
  ['openScoreboardBtn', 'openScoreboardLink'].forEach(id =>
    document.getElementById(id).addEventListener('click', e => openPopup(e, ...scoreboardWindow)));
  document.getElementById('openQuizmasterLink').addEventListener('click', e => openPopup(e, ...quizmasterWindow));

  // Risk bet
  document.getElementById('confirmBetBtn').addEventListener('click', confirmBet);

  // Timer actions
  document.getElementById('answerGivenBtn').addEventListener('click', onAnswerGiven);

  // Answer resolution
  document.getElementById('correctBtn').addEventListener('click', handleCorrect);
  document.getElementById('wrongBtn').addEventListener('click', handleWrong);
  document.getElementById('closeQuestionBtn').addEventListener('click', finishQuestion);

  // Timeout actions
  document.getElementById('showAnswerTimeoutBtn').addEventListener('click', showAnswerAfterTimeout);
  document.getElementById('closeAfterTimeoutBtn').addEventListener('click', finishQuestion);
});
