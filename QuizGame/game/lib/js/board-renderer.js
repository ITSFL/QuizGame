/*
 * Copyright 2026 by Florian Lohkamp
 * Lizenz: GNU GPL v3, siehe LIZENZ_DE_GNU_GPL_v3.md im Projektordner
 */
// Board Renderer
class BoardRenderer {
  constructor() {
    this.boardElement = document.getElementById('gameBoard');
    this.scoreboardElement = document.getElementById('scoreboard');
    this.onQuestionClick = null;
  }

  renderBoard(quizData, gameState) {
    this.boardElement.innerHTML = '';
    const categories = quizData.quiz.categories;
    const pointValues = quizData.quiz.pointValues;
    this.boardElement.style.gridTemplateColumns = `repeat(${categories.length}, 1fr)`;

    // Category headers
    categories.forEach(category => {
      const header = document.createElement('div');
      header.className = 'board-category';
      header.textContent = category.name;
      this.boardElement.appendChild(header);
    });

    // Point value cells
    pointValues.forEach(value => {
      categories.forEach(category => {
        const question = category.questions.find(q => q.value === value);
        const cell = document.createElement('button');
        cell.className = 'board-cell btn';

        if (!question) {
          cell.disabled = true;
          cell.className += ' answered';
          this.boardElement.appendChild(cell);
          return;
        }

        cell.textContent = value;
        cell.dataset.categoryId = category.id;
        cell.dataset.questionId = question.id;
        cell.dataset.value = value;

        if (gameState.isQuestionAnswered(question.id)) {
          cell.className += ' answered';
          cell.disabled = true;
        } else {
          cell.addEventListener('click', () => {
            if (this.onQuestionClick) {
              this.onQuestionClick(question, category);
            }
          });
        }

        this.boardElement.appendChild(cell);
      });
    });
  }

  renderScoreboard(gameState) {
    this.scoreboardElement.innerHTML = '';
    gameState.teams.forEach(team => {
      const scoreDiv = document.createElement('div');
      scoreDiv.className = 'team-score';
      if (team.id === gameState.currentTeamIndex) {
        scoreDiv.classList.add('active');
      }
      scoreDiv.innerHTML = `
        <div class="team-name">${this.escapeHtml(team.name)}</div>
        <div class="team-points">${team.score}</div>
      `;
      this.scoreboardElement.appendChild(scoreDiv);
    });
  }

  updateCellStatus(questionId) {
    const cell = this.boardElement.querySelector(`[data-question-id="${questionId}"]`);
    if (cell) {
      cell.classList.add('answered');
      cell.disabled = true;
    }
  }

  highlightActiveTeam(gameState) {
    const scoreItems = this.scoreboardElement.querySelectorAll('.team-score');
    scoreItems.forEach((item, index) => {
      item.classList.toggle('active', index === gameState.currentTeamIndex);
    });

    const indicator = document.getElementById('activeTeamIndicator');
    if (indicator) {
      const team = gameState.getCurrentTeam();
      indicator.textContent = `🎯 Am Zug: ${team.name}`;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

