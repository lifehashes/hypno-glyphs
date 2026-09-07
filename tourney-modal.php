<div id="tournamentModal" class="modal-overlay hidden">
  <div class="modal-card tournament-card">
    
    <!-- Modal Header -->
    <div class="modal-header">
      <h2 id="tourneyTitle">GLYPH TOURNAMENT</h2>
      <button id="closeTourneyModalBtn" class="help-btn close-btn">&times;</button>
    </div>

    <!-- State 1: Setup View -->
    <div id="tourneySetupView" class="modal-body">
      <p class="subtitle">Select participating Glyphs (4, 8, or 16):</p>
      
      <div id="glyphPickerGrid" class="glyph-picker-grid">
        <!-- Dynamically populated via JS with selectable glyph cards -->
      </div>

      <div class="setup-controls">
        <label for="tourneySizeSelect">Participants:</label>
        <select id="tourneySizeSelect" class="help-select">
          <option value="4">4 Glyphs</option>
          <option value="8" selected>8 Glyphs</option>
          <option value="16">16 Glyphs</option>
        </select>
        <button id="rndPopBracket" class="help-btn" onClick="populateBracket();">Assign Glyphs (RND)</button>
        <button id="startTourneyBtn" class="help-btn" disabled>Start Tournament</button>
      </div>
    </div>

    <!-- State 2: Bracket View -->
    <div id="tourneyBracketView" class="modal-body hidden">
      <div id="bracketTreeContainer" class="bracket-tree-container">
        <!-- Dynamically populated rounds and matchup nodes -->
      </div>

      <div class="tourney-footer">
        <div id="tourneyStatusMessage" class="status-msg">Round 1 Ready</div>
        <button id="nextMatchBtn" class="help-btn highlight">Launch Next Match</button>
      </div>
    </div>

  </div>
</div>