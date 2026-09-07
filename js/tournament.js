// Global glyph pool accessible across tournament functions
let glyphPool = [];

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
 * Randomly samples 'count' Glyphs from the available pool and populates Round 1.
 * @param {Array} pool - Array of Glyph objects available for selection
 * @param {number} count - Target size (4, 8, or 16)
 */
function populateBracket(pool = glyphPool, count) {
  // If count is not explicitly supplied, read from the dropdown selector
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

  // 1. Re-render the empty structure to clear old matches
  renderEmptyBracket(count);

  // 2. Fisher-Yates shuffle to randomly draw participants without replacement
  const poolCopy = [...activePool];
  for (let i = poolCopy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [poolCopy[i], poolCopy[j]] = [poolCopy[j], poolCopy[i]];
  }
  const participants = poolCopy.slice(0, count);

  // 3. Locate Outer Round 1 Columns (First and Last columns in container)
  const container = document.getElementById('bracketTreeContainer');
  const columns = container.querySelectorAll('.bracket-column');
  const leftR1 = columns[0];
  const rightR1 = columns[columns.length - 1];

  const leftCards = leftR1.querySelectorAll('.matchup-card');
  const rightCards = rightR1.querySelectorAll('.matchup-card');

  // 4. Populate Round 1 matchups symmetrically
  let pIndex = 0;

  leftCards.forEach((card) => {
    const slots = card.querySelectorAll('.matchup-slot');
    assignParticipantToSlot(slots[0], participants[pIndex++]);
    assignParticipantToSlot(slots[1], participants[pIndex++]);
  });

  rightCards.forEach((card) => {
    const slots = card.querySelectorAll('.matchup-slot');
    assignParticipantToSlot(slots[0], participants[pIndex++]);
    assignParticipantToSlot(slots[1], participants[pIndex++]);
  });
}

/**
 * Extracts characters 4-9 from a 64-char hex string to create a CSS color hex code.
 * @param {string} id - The 64-character hash string
 * @returns {string} - The hex color code (e.g., "#A1B2C3")
 */
function getColorFromId(id) {
  if (typeof id === 'string' && id.length >= 9) {
    // Slice characters 4 through 9 (index 3 up to 9)
    return `#${id.slice(3, 9)}`;
  }
  return '#00ffff'; // Fallback color
}

/**
 * Assigns a participant object to a target matchup DOM slot element.
 * @param {HTMLElement} slotElement - The DOM element representing the matchup slot
 * @param {Object} participant - The Glyph object containing details to display
 */
function assignParticipantToSlot(slotElement, participant) {
  if (!slotElement) return;

  if (participant) {
    slotElement.classList.remove('placeholder');
    slotElement.classList.add('filled');
    slotElement.dataset.glyphId = participant.id || '';
    
    // Derive intrinsic color from the 64-char ID
    const color = getColorFromId(participant.id);
    const name = participant.name || 'UNKNOWN';
    const owner = participant.owner || 'Unknown Owner';
    const gen = participant.generations ?? participant.gen ?? 0;
    const score = participant.score || 0;

    slotElement.innerHTML = `
      <div class="slot-info">
        <span class="slot-name" style="color: ${color};">${name}</span>
        <span class="slot-meta">Owner: ${owner} | Gen: ${gen}</span>
      </div>
      <span class="slot-score">${score}</span>
    `;
  } else {
    slotElement.classList.remove('filled', 'winner', 'loser');
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