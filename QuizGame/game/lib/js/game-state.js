/*
 * Copyright 2026 by Florian Lohkamp
 * Lizenz: GNU GPL v3, siehe LIZENZ_DE_GNU_GPL_v3.md im Projektordner
 */
// Game State Management
class GameState {
  constructor() {
    this.teams = [];
    this.currentTeamIndex = 0;
    this.answeredQuestions = new Set();
    this.quizData = null;
    this.gameOver = false;
    this.currentBet = 0;
    this.attemptedTeams = new Map();
  }

  initializeTeams(teamCount, teamNames) {
    this.teams = [];
    for (let i = 0; i < teamCount; i++) {
      this.teams.push({
        id: i,
        name: teamNames[i] || `Team ${i + 1}`,
        score: 0
      });
    }
  }

  loadQuizData(data) {
    this.quizData = data;
    this.answeredQuestions = new Set();
    this.attemptedTeams = new Map();
    this.gameOver = false;
    this.currentBet = 0;
  }

  randomizeStartTeam() {
    this.currentTeamIndex = Math.floor(Math.random() * this.teams.length);
    return this.teams[this.currentTeamIndex];
  }

  getCurrentTeam() {
    return this.teams[this.currentTeamIndex];
  }

  getTeamById(id) {
    return this.teams.find(t => t.id === id);
  }

  setCurrentTeamIndex(index) {
    this.currentTeamIndex = index;
  }

  markTeamAttempted(questionId, teamId) {
    if (!this.attemptedTeams.has(questionId)) {
      this.attemptedTeams.set(questionId, new Set());
    }
    this.attemptedTeams.get(questionId).add(teamId);
  }

  // Nächstes Team in Rotationsreihenfolge, das die Frage noch nicht versucht hat; -1 wenn keines
  findNextAvailableTeamIndex(questionId) {
    const attempted = this.attemptedTeams.get(questionId) || new Set();
    for (let step = 1; step < this.teams.length; step++) {
      const index = (this.currentTeamIndex + step) % this.teams.length;
      if (!attempted.has(this.teams[index].id)) return index;
    }
    return -1;
  }

  // Falsche Antworten führen zu keinem Punktabzug
  awardPoints(pointValue) {
    this.getCurrentTeam().score += pointValue;
  }

  awardRiskPoints(pointValue, bet) {
    this.getCurrentTeam().score += bet + pointValue;
  }

  markQuestionAsAnswered(questionId) {
    this.answeredQuestions.add(questionId);
  }

  isQuestionAnswered(questionId) {
    return this.answeredQuestions.has(questionId);
  }

  checkGameOver() {
    if (!this.quizData) return false;
    let totalQuestions = 0;
    this.quizData.quiz.categories.forEach(cat => {
      totalQuestions += cat.questions.length;
    });
    if (this.answeredQuestions.size >= totalQuestions) {
      this.gameOver = true;
      return true;
    }
    return false;
  }

  getRanking() {
    return [...this.teams]
      .sort((a, b) => b.score - a.score)
      .map((team, index) => ({ rank: index + 1, ...team }));
  }

  getQuestion(categoryId, value) {
    if (!this.quizData) return null;
    const category = this.quizData.quiz.categories.find(c => c.id === categoryId);
    if (!category) return null;
    return category.questions.find(q => q.value === value) || null;
  }

  reset() {
    this.teams = [];
    this.currentTeamIndex = 0;
    this.answeredQuestions = new Set();
    this.attemptedTeams = new Map();
    this.quizData = null;
    this.gameOver = false;
    this.currentBet = 0;
  }
}

