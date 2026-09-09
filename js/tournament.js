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
 * Launches or continues a matchup (Handles Round 1 vs Round 2 positions)
 */
function launchNextMatch() {
  if (currentTournament.isFinished) {
    alert("Tournament complete! Generate a new bracket to restart.");
    return;
  }

  // Find next uncompleted match in current tournament round
  const currentRoundMatches = currentTournament.rounds[currentTournament.currentRound - 1];
  let match = currentRoundMatches.find(m => !m.completed);

  if (!match) {
    // Advance to next tournament round if available
    if (currentTournament.currentRound < currentTournament.rounds.length) {
      currentTournament.currentRound++;
      const newRoundMatches = currentTournament.rounds[currentTournament.currentRound - 1];
      match = newRoundMatches.find(m => !m.completed);
    }
  }

  if (!match || !match.p1 || !match.p2) {
    updateStatusMessage("Waiting for prior matches to finish...");
    return;
  }

  // Track sub-round within the match object (0 = Leg 1, 1 = Leg 2)
  if (match.subRound === undefined) {
    match.subRound = 0;
    match.p1Scores = [0, 0];
    match.p2Scores = [0, 0];
  }

  currentTournament.activeMatch = match;
  renderBracketUI();

  // Hide modal overlay to reveal arena
  const tourneyModal = document.getElementById('tournamentModal');
  if (tourneyModal) tourneyModal.classList.add('hidden');

  // 1. Reset active scores
  if (typeof scores !== 'undefined') {
    scores.alphaScore = 0;
    scores.betaScore = 0;
  }

  // 2. Clear physical particles
  if (typeof arena !== 'undefined' && arena.softReset) {
    arena.softReset();
  } else if (typeof arena !== 'undefined') {
    arena.particles = [];
    if (arena.clusters) arena.clusters = [];
    if (arena.effects) arena.effects = [];
  }

  // 3. Swap Glyphs between Alpha/Beta positions based on Sub-Round
  const isLegTwo = (match.subRound === 1);
  const alphaGlyph = isLegTwo ? match.p2 : match.p1;
  const betaGlyph  = isLegTwo ? match.p1 : match.p2;

  alphaEngine.loadFromBinary(alphaGlyph.bin, alphaGlyph.generations);
  betaEngine.loadFromBinary(betaGlyph.bin, betaGlyph.generations);

  document.getElementById('alpha-name').innerText = alphaGlyph.name;
  document.getElementById('alpha-owner').innerText = alphaGlyph.owner;
  updateGlyphColorStyling('alpha', alphaEngine.intrinsicColor);

  document.getElementById('beta-name').innerText = betaGlyph.name;
  document.getElementById('beta-owner').innerText = betaGlyph.owner;
  updateGlyphColorStyling('beta', betaEngine.intrinsicColor);

  // 4. Reset internal state timers for active modules
  if (typeof arena !== 'undefined' && arena.modules) {
    arena.modules.forEach(mod => {
      if (mod.stepTimer !== undefined) mod.stepTimer = 0;
      if (mod.activeParticles) mod.activeParticles.clear();
      if (mod.processedParticles) mod.processedParticles = new WeakSet();
    });
  }

  // 5. Restart match loop
  isRunning = true;
  const simBtn = document.getElementById('sim-btn');
  if (simBtn) {
    simBtn.innerText = "||";
    simBtn.classList.remove('pulse-green');
  }

  alphaEngine.render();
  betaEngine.render();
  if (typeof updateHUD === 'function') updateHUD();

  // Show "ROUND 1" or "ROUND 2" overlay over the canvas
  const legLabel = `ROUND ${match.subRound + 1}`;
  showCanvasRoundOverlay(legLabel, 2000);

  updateStatusMessage(
    `Match ${match.id} (Leg ${match.subRound + 1}/2): ` +
    `${match.p1.name} vs ${match.p2.name}`
  );
  loop();
}

/**
 * Records scores and handles Round 1 -> Round 2 transition or Bracket Propagation
 */
function recordMatchResult(alphaScore, betaScore) {
  const match = currentTournament.activeMatch;
  if (!match) return;

  const isLegTwo = (match.subRound === 1);

  // Map scores back to original participant entities
  if (!isLegTwo) {
    match.p1Scores[0] = alphaScore;
    match.p2Scores[0] = betaScore;
    
    // Increment to Leg 2 and relaunch
    match.subRound = 1;
    updateStatusMessage(`Leg 1 finished! Preparing Leg 2 (Swapping Positions)...`);
    
    // Short delay before automatically starting Leg 2
    setTimeout(() => {
      launchNextMatch();
    }, 1000);

    return; // Stop here; do not declare a winner yet
  }

  // Handle Leg 2 Scores (Positions were inverted, so Alpha is p2, Beta is p1)
  match.p1Scores[1] = betaScore;
  match.p2Scores[1] = alphaScore;

  // Aggregate Total Scores
  match.p1Score = match.p1Scores[0] + match.p1Scores[1];
  match.p2Score = match.p2Scores[0] + match.p2Scores[1];
  match.completed = true;

  // Decide Winner based on aggregated totals
  if (match.p1Score >= match.p2Score) {
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

// Base Match Data Structure
function createMatch(matchId, playerA, playerB) {
  return {
    id: matchId,
    players: { A: playerA, B: playerB },
    currentRound: 0, // 0 = Round 1, 1 = Round 2, 2 = Complete
    scores: { A: [0, 0], B: [0, 0] }, // [Round 1, Round 2]
    status: 'pending', // 'pending', 'in_progress', 'completed'
    winner: null
  };
}

// Map Emitter Positions Based on Active Round
function getEmitterConfigForRound(match, baseEmitters, canvasWidth) {
  const isRoundTwo = match.currentRound === 1;

  return baseEmitters.map(emitter => {
    // Determine player assignment and position based on round index
    const assignedPlayer = (emitter.team === 'A' ^ isRoundTwo) ? match.players.A : match.players.B;
    
    // Invert X coordinate for symmetry swap during Round 2
    const currentX = isRoundTwo ? (canvasWidth - emitter.x) : emitter.x;

    return {
      ...emitter,
      x: currentX,
      owner: assignedPlayer,
      activeTeam: (emitter.team === 'A' ^ isRoundTwo) ? 'A' : 'B'
    };
  });
}

// Match Lifecycle Handler
class MatchRunner {
  constructor(arenaManager, lifeEngine) {
    this.arena = arenaManager;
    this.engine = lifeEngine;
  }

  // Load and launch current sub-round
  startSubRound(match, baseEmitters) {
    match.status = 'in_progress';
    
    // 1. Reset simulation grid and particle state
    this.engine.resetGrid();
    this.arena.clearParticles();

    // 2. Resolve emitter placement with current round's positions
    const activeEmitters = getEmitterConfigForRound(
      match, 
      baseEmitters, 
      this.arena.canvas.width
    );

    // 3. Apply emitters to the arena manager
    this.arena.setEmitters(activeEmitters);
    
    // 4. Begin simulation loop
    this.arena.start();
  }

  // Finalize current sub-round and transition to Round 2 or Complete
  onSubRoundEnd(match, baseEmitters, roundScoreA, roundScoreB) {
    const roundIdx = match.currentRound;
    
    // Record scores for the active round
    match.scores.A[roundIdx] = roundScoreA;
    match.scores.B[roundIdx] = roundScoreB;

    if (roundIdx === 0) {
      // Transition to Round 2
      match.currentRound = 1;
      this.startSubRound(match, baseEmitters);
    } else {
      // Both rounds finished — calculate totals and finalize
      match.currentRound = 2;
      match.status = 'completed';

      const totalA = match.scores.A[0] + match.scores.A[1];
      const totalB = match.scores.B[0] + match.scores.B[1];

      // Handle win/tie logic (can be updated for tiebreakers if totals match)
      match.winner = totalA >= totalB ? match.players.A : match.players.B;
      
      this.arena.stop();
      return match.winner;
    }
  }
}

/**
 * Triggers a temporary overlay message over the canvas container.
 * @param {string} text - Message to display (e.g., "ROUND 1", "ROUND 2")
 * @param {number} duration - Display time in milliseconds (default: 2000ms)
 */
function showCanvasRoundOverlay(text, duration = 2000) {
  let overlayEl = document.getElementById('canvasRoundOverlay');
  
  // Create the overlay DOM element dynamically if it doesn't exist
  if (!overlayEl) {
    overlayEl = document.createElement('div');
    overlayEl.id = 'canvasRoundOverlay';
    overlayEl.className = 'round-overlay';
    
    // Attach relative to the main canvas wrapper container
    const container = document.getElementById('canvas-container') || document.body;
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }
    container.appendChild(overlayEl);
  }

  overlayEl.innerText = text;
  
  // Fade in
  requestAnimationFrame(() => {
    overlayEl.classList.add('show');
  });

  // Fade out and clean up
  setTimeout(() => {
    overlayEl.classList.remove('show');
  }, duration);
}