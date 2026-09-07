// Global glyph pool accessible across tournament functions
let glyphPool = [];

// Tournament execution state tracking
let currentTournament = {
  size: 8,
  currentRound: 1,
  currentMatchIndex: 0,
  activeMatch: null,
  isFinished: false,
  rounds: [] // Array of rounds, each containing match objects
};

/**
 * Initializes the global glyphPool from database or procedural source data
 * @param {Array} rawGlyphs - The array of glyph objects loaded from PHP
 */
function initGlyphPool(rawGlyphs = []) {
  glyphPool = rawGlyphs.map((glyph, idx) => ({
    id: glyph.HASH || `glyph_${idx}`,
    name: glyph.BATTLE_NAME || `GLYPH_${idx}`,
    bin: glyph.BIN,
    generations: parseInt(glyph.GENERATIONS, 10) || 500,
    owner: glyph.OWNER || 'SYSTEM',
    score: 0
  }));
}

/**
 * Extracts characters 4-9 from a 64-char hex string to create a CSS color hex code.
 * @param {string} id - The 64-character hash string
 * @returns {string} - The hex color code (e.g., "#A1B2C3")
 */
function getColorFromId(id) {
  if (typeof id === 'string' && id.length >= 9) {
    return `#${id.slice(3, 9)}`;
  }
  return '#00ffff';
}

/**
 * Assigns a participant object to a target matchup DOM slot element.
 * @param {HTMLElement} slotElement - The DOM element representing the matchup slot
 * @param {Object} participant - The Glyph object containing details to display
 * @param {boolean} isWinner - Whether participant won the match
 * @param {boolean} isLoser - Whether participant lost the match
 */
function assignParticipantToSlot(slotElement, participant, isWinner = false, isLoser = false) {
  if (!slotElement) return;

  slotElement.classList.remove('placeholder', 'winner', 'loser', 'filled');

  if (participant) {
    slotElement.classList.add('filled');
    if (isWinner) slotElement.classList.add('winner');
    if (isLoser) slotElement.classList.add('loser');
    
    slotElement.dataset.glyphId = participant.id || '';
    
    const color = getColorFromId(participant.id);
    const name = participant.name || 'UNKNOWN';
    const owner = participant.owner || 'Unknown Owner';
    const gen = participant.generations ?? participant.gen ?? 0;
    const score = participant.score !== undefined ? participant.score : 0;

    slotElement.innerHTML = `
      <div class="slot-info">
        <span class="slot-name" style="color: ${color};">${name}</span>
        <span class="slot-meta">Owner: ${owner} | Gen: ${gen}</span>
      </div>
      <span class="slot-score">${score}</span>
    `;
  } else {
    slotElement.classList.add('placeholder');
    delete slotElement.dataset.glyphId;
    
    slotElement.innerHTML = `
      <div class="slot-info">
        <span class="slot-name">-- TBD --</span>
      </div>
      <span class="slot-score">0</span>
    `;
  }
}

/**
 * Prepares the tournament structure in memory and resets round trackers.
 * @param {number} count - Participant count (4, 8, or 16)
 * @param {Array} participants - Selected Glyph objects
 */
function setupTournamentState(count, participants) {
  const totalRounds = Math.log2(count);
  currentTournament = {
    size: count,
    currentRound: 1,
    currentMatchIndex: 0,
    activeMatch: null,
    isFinished: false,
    rounds: []
  };

  // Build round structures
  for (let r = 1; r <= totalRounds; r++) {
    const matchCount = count / Math.pow(2, r);
    const roundMatches = [];

    for (let m = 0; m < matchCount; m++) {
      roundMatches.push({
        id: `r${r}_m${m}`,
        round: r,
        matchIndex: m,
        p1: null,
        p2: null,
        p1Score: 0,
        p2Score: 0,
        winner: null,
        completed: false
      });
    }
    currentTournament.rounds.push(roundMatches);
  }

  // Seed Round 1
  const round1 = currentTournament.rounds[0];
  let pIdx = 0;
  for (let m = 0; m < round1.length; m++) {
    round1[m].p1 = { ...participants[pIdx++] };
    round1[m].p2 = { ...participants[pIdx++] };
  }

  // Enable Start / Next Match controls
  const startBtn = document.getElementById('startTourneyBtn');
  if (startBtn) startBtn.disabled = false;

  renderBracketUI();
}

/**
 * Randomly samples Glyphs from pool and builds the tournament bracket.
 */
function populateBracket(pool = glyphPool, count) {
  if (!count) {
    const sizeSelect = document.getElementById('tourneySizeSelect');
    count = sizeSelect ? parseInt(sizeSelect.value, 10) : 8;
  }

  const activePool = pool && pool.length > 0 ? pool : glyphPool;

  if (!activePool || activePool.length < count) {
    console.error(`Not enough glyphs in pool (${activePool?.length}) to populate ${count}-slot bracket.`);
    alert(`Not enough Glyphs loaded in pool (${activePool?.length || 0}) to populate a ${count}-participant bracket.`);
    return;
  }

  // Fisher-Yates shuffle
  const poolCopy = [...activePool];
  for (let i = poolCopy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [poolCopy[i], poolCopy[j]] = [poolCopy[j], poolCopy[i]];
  }
  const participants = poolCopy.slice(0, count);

  setupTournamentState(count, participants);

  // Switch setup view to bracket view automatically
  document.getElementById('tourneySetupView').classList.add('hidden');
  document.getElementById('tourneyBracketView').classList.remove('hidden');
  updateStatusMessage(`Round 1 Ready — Click "Launch Next Match" to begin.`);
}

/**
 * Renders the state of the tournament into the DOM bracket structure.
 */
function renderBracketUI() {
  const container = document.getElementById('bracketTreeContainer');
  if (!container || currentTournament.rounds.length === 0) return;

  renderEmptyBracket(currentTournament.size);

  const columns = container.querySelectorAll('.bracket-column');
  const totalRounds = currentTournament.rounds.length;

  // Map rounds to bracket DOM column indices
  currentTournament.rounds.forEach((roundData, rIdx) => {
    const roundNum = rIdx + 1;

    if (roundNum === totalRounds) {
      // Final Round -> Center Column
      const centerCol = container.querySelector('.center-final');
      if (centerCol && roundData[0]) {
        const matchCard = centerCol.querySelector('.matchup-card');
        if (matchCard) updateMatchupCardDOM(matchCard, roundData[0]);
      }
    } else {
      // Outer columns (Left and Right halves)
      const leftCol = columns[rIdx];
      const rightCol = columns[columns.length - 1 - rIdx];

      const halfMatches = roundData.length / 2;
      const leftCards = leftCol ? leftCol.querySelectorAll('.matchup-card') : [];
      const rightCards = rightCol ? rightCol.querySelectorAll('.matchup-card') : [];

      for (let i = 0; i < halfMatches; i++) {
        if (leftCards[i]) updateMatchupCardDOM(leftCards[i], roundData[i]);
      }
      for (let i = 0; i < halfMatches; i++) {
        if (rightCards[i]) updateMatchupCardDOM(rightCards[i], roundData[halfMatches + i]);
      }
    }
  });
}

/**
 * Updates a matchup card element with match details and winner states.
 */
function updateMatchupCardDOM(cardElement, match) {
  if (currentTournament.activeMatch === match) {
    cardElement.classList.add('active-match');
  } else {
    cardElement.classList.remove('active-match');
  }

  const slots = cardElement.querySelectorAll('.matchup-slot');
  const p1IsWinner = match.completed && match.winner === match.p1;
  const p1IsLoser  = match.completed && match.winner === match.p2;
  const p2IsWinner = match.completed && match.winner === match.p2;
  const p2IsLoser  = match.completed && match.winner === match.p1;

  if (match.p1) match.p1.score = match.p1Score;
  if (match.p2) match.p2.score = match.p2Score;

  assignParticipantToSlot(slots[0], match.p1, p1IsWinner, p1IsLoser);
  assignParticipantToSlot(slots[1], match.p2, p2IsWinner, p2IsLoser);
}

/**
 * Launches the currently queued match in the main physics arena.
 */
function launchNextMatch() {
  if (currentTournament.isFinished) {
    alert("Tournament complete! Generate a new bracket to restart.");
    return;
  }

  // Find next uncompleted match in current round
  const currentRoundMatches = currentTournament.rounds[currentTournament.currentRound - 1];
  let nextMatch = currentRoundMatches.find(m => !m.completed);

  if (!nextMatch) {
    // Advance to next round if available
    if (currentTournament.currentRound < currentTournament.rounds.length) {
      currentTournament.currentRound++;
      const newRoundMatches = currentTournament.rounds[currentTournament.currentRound - 1];
      nextMatch = newRoundMatches.find(m => !m.completed);
    }
  }

  if (!nextMatch || !nextMatch.p1 || !nextMatch.p2) {
    updateStatusMessage("Waiting for prior matches to finish...");
    return;
  }

  currentTournament.activeMatch = nextMatch;
  renderBracketUI();

  // Hide modal overlay to reveal arena
  const tourneyModal = document.getElementById('tournamentModal');
  if (tourneyModal) tourneyModal.classList.add('hidden');

  // 1. Reset match scores without resetting arena structures
  if (typeof scores !== 'undefined') {
    scores.alphaScore = 0;
    scores.betaScore = 0;
  }

  // 2. Clear lingering physical particles & clusters while keeping placed modules intact
  if (typeof arena !== 'undefined' && arena.softReset) {
    arena.softReset();
  } else if (typeof arena !== 'undefined') {
    arena.particles = [];
    if (arena.clusters) arena.clusters = [];
    if (arena.effects) arena.effects = [];
  }

  // 3. Load match Glyphs into existing LifeEngines
  alphaEngine.loadFromBinary(nextMatch.p1.bin, nextMatch.p1.generations);
  betaEngine.loadFromBinary(nextMatch.p2.bin, nextMatch.p2.generations);

  document.getElementById('alpha-name').innerText = nextMatch.p1.name;
  document.getElementById('alpha-owner').innerText = nextMatch.p1.owner;
  updateGlyphColorStyling('alpha', alphaEngine.intrinsicColor);

  document.getElementById('beta-name').innerText = nextMatch.p2.name;
  document.getElementById('beta-owner').innerText = nextMatch.p2.owner;
  updateGlyphColorStyling('beta', betaEngine.intrinsicColor);

  // 4. Reset GOL engines to initial state
  // alphaEngine.resetToInitial();
  // betaEngine.resetToInitial();

  // 5. Reset internal state timers for active spawner/QCD modules in the existing arena
  if (typeof arena !== 'undefined' && arena.modules) {
    arena.modules.forEach(mod => {
      if (mod.stepTimer !== undefined) mod.stepTimer = 0;
      if (mod.activeParticles) mod.activeParticles.clear();
      if (mod.processedParticles) mod.processedParticles = new WeakSet();
    });
  }

  // 6. Explicitly restart match execution loop
  isRunning = true;
  const simBtn = document.getElementById('sim-btn');
  if (simBtn) {
    simBtn.innerText = "||";
    simBtn.classList.remove('pulse-green');
  }

  // Force immediate render update to clear frozen frames
  alphaEngine.render();
  betaEngine.render();
  if (typeof updateHUD === 'function') updateHUD();

  updateStatusMessage(`Playing: Round ${nextMatch.round} - ${nextMatch.p1.name} vs ${nextMatch.p2.name}`);
  loop();
}

/**
 * Called by physics engine when active tournament match terminates.
 * Records scores and propagates winner forward.
 */
function recordMatchResult(alphaScore, betaScore) {
  const match = currentTournament.activeMatch;
  if (!match) return;

  match.p1Score = alphaScore;
  match.p2Score = betaScore;
  match.completed = true;

  // Decide Winner
  if (alphaScore >= betaScore) {
    match.winner = match.p1;
  } else {
    match.winner = match.p2;
  }

  // Propagate winner into next round match slot
  const currentRoundIdx = match.round - 1;
  if (currentRoundIdx + 1 < currentTournament.rounds.length) {
    const nextRoundMatches = currentTournament.rounds[currentRoundIdx + 1];
    const targetMatchIdx = Math.floor(match.matchIndex / 2);
    const targetMatch = nextRoundMatches[targetMatchIdx];

    if (match.matchIndex % 2 === 0) {
      targetMatch.p1 = { ...match.winner, score: 0 };
    } else {
      targetMatch.p2 = { ...match.winner, score: 0 };
    }
  } else {
    // Final Match Completed!
    currentTournament.isFinished = true;
    updateStatusMessage(`🏆 TOURNAMENT CHAMPION: ${match.winner.name}!`);
  }

  currentTournament.activeMatch = null;
  renderBracketUI();

  // Show tournament modal to display progress
  const tourneyModal = document.getElementById('tournamentModal');
  if (tourneyModal) tourneyModal.classList.remove('hidden');
}

/**
 * Updates status text in footer of bracket modal view.
 */
function updateStatusMessage(msg) {
  const statusEl = document.getElementById('tourneyStatusMessage');
  if (statusEl) statusEl.innerText = msg;
}

// Attach launch handler
document.addEventListener('DOMContentLoaded', () => {
  const nextMatchBtn = document.getElementById('nextMatchBtn');
  if (nextMatchBtn) {
    nextMatchBtn.addEventListener('click', launchNextMatch);
  }
});