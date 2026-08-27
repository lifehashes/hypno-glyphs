<?php

    session_start();
    include_once __DIR__ . '/../../priv/db_conf_laniakea.php';    

    // USER INFORMATION (IF LOGGED IN)
    $current_operator = htmlspecialchars($_SESSION['username']);
    $operator_id      = htmlspecialchars($_SESSION['user_id']);

    // TRACK SITE VISITS
    $site_token = 'HYPNO-GLYPHS';    
    $session_key = 'has_logged_' . $site_token;

    if (!isset($_SESSION[$session_key])) {
        try {
            $stmt = $pdo->prepare("INSERT INTO page_visits (site_token, operator_id, username) VALUES (?, ?, ?)");
            $stmt->execute([$site_token, $operator_id, $current_operator]);
            
            $_SESSION[$session_key] = true;
        } catch (Exception $e) {
            // Fail silently
        }
    }

    // FETCH USER GLYPHS
    $stmt = $pdo->prepare("
        SELECT 
            g.BATTLE_NAME, 
            g.ITERATIONS AS GENERATIONS, 
            g.PEAK, 
            g.MAX, 
            g.OWNER, 
            g.BIN, 
            g.HASH,
            g.GRID_SIZE
        FROM GLYPHREG g
        WHERE g.OWNER = :owner_id AND g.GRID_SIZE='16'
        GROUP BY g.BATTLE_NAME, g.ITERATIONS, g.PEAK, g.MAX, g.OWNER, g.BIN, g.HASH, g.GRID_SIZE
        ORDER BY g.BATTLE_NAME ASC
    ");
            
    $stmt->execute(['owner_id' => $current_operator]);
    $myGlyphs = $stmt->fetchAll(PDO::FETCH_ASSOC);

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>HYPNOGLYPHS // GENERATIVE PHYSICS ENGINE</title>
    <SCRIPT SRC="js/gol.js"></SCRIPT>
    <SCRIPT SRC="js/hypnophysics.js"></SCRIPT>
    <SCRIPT SRC="js/sha256.js"></SCRIPT>	
    <link rel="stylesheet" href="styles.css">
    <style>

        /* Palette Container Sidebar */
        .editor-palette-box {
            display: none; /* Toggled via JS */
            flex-direction: column;
            gap: 8px;
            box-sizing: border-box;
            overflow-y: auto;
        }

        .palette-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            margin-top: 5px;
        }

        .palette-card {
            aspect-ratio: 1 / 1;
            box-sizing: border-box;
            background: rgba(15, 20, 30, 0.7);
            border: 1px solid rgba(66, 244, 133, 0.2);
            border-radius: 4px;
            padding: 8px 4px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 6px;
            cursor: grab;
            user-select: none;
            transition: all 0.2s ease;
        }

        .palette-card:hover {
            background: rgba(66, 244, 133, 0.12);
            border-color: #42f485;
            box-shadow: 0 0 10px rgba(66, 244, 133, 0.3);
        }

        .palette-card:active {
            cursor: grabbing;
        }

        .palette-card svg {
            width: 32px;
            height: 32px;
            display: block;
        }

        .palette-card span {
            font-family: monospace;
            font-size: 9px;
            color: #d1d5db;
            text-align: center;
            letter-spacing: 0.5px;
        }

    </style>
</head>
<body>

<div class="outer-frame">
    <div class="terminal-header">
        <div class="stat-line">HYPNOGLYPHS // B3/S23-PHYSICS ENGINE v0.1</div>
        <div class="stat-line" style="border:none; gap:15px;">
            <span>STATUS: <span style="color:var(--accent-green)">ONLINE</span></span>
            <span>FPS: <span id="fps-counter" class="stat-value">60</span></span>
        </div>
    </div>

    <!-- METRIC BARS CONTAINER -->
    <div style="width: 100%; display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px;">
        <!-- Top Bar: Scores (4px high) -->
        <canvas id="score-bar-canvas" height="4" style="width: 100%; display: block;"></canvas>
        <!-- Bottom Bar: Particle Count (2px high) -->
        <canvas id="particle-bar-canvas" height="2" style="width: 100%; display: block;"></canvas>
    </div>

    <div class="duel-stage">
        <!-- SOURCE MODULE ALPHA (PLAY MODE) -->
        <div class="player-box" id="alpha-panel">
            <div class="pane-title">SOURCE :: ALPHA</div>
            <div class="glyph-preview">
                <canvas id="glyph-alpha-canvas" width="80" height="80"></canvas>
            </div>
            <div class="stat-line">
                <span>DESIGNATION:</span>
                <span class="stat-value" id="alpha-name">P_56_10</span>
            </div>
            <div class="stat-line">
                <span>OWNER:</span>
                <span class="stat-value" id="alpha-owner" style="color: #00ffff;">-</span>
            </div>
            <div class="stat-line">
                <span>INTRINSIC HUE:</span>
                <span class="stat-value" id="alpha-color" style="color: #42f485">#42F485</span>
            </div>
            <div class="stat-line">
                <span>GENERATION:</span>
                <span class="stat-value" id="alpha-gen">0 / 500</span>
            </div>
            <div class="stat-line">
                <span>PARTICLES ACTIVE:</span>
                <span class="stat-value" id="alpha-particles">0</span>
            </div>
            <div class="stat-line">
                <span>SCORE:</span>
                <span class="stat-value" id="alpha-score" style="color:#00ffff; font-weight:bold;">0</span>
            </div>
            <div class="stat-line" style="flex-direction:column; align-items:flex-start; gap:2px;">
                <span style="font-size:10px; opacity:0.6;">ORIGIN HASH:</span>
                <span class="stat-value" id="alpha-origin-hash" style="font-size:9px; word-break:break-all; font-family:monospace;">-</span>
            </div>
            <div class="stat-line" style="flex-direction:column; align-items:flex-start; gap:2px;">
                <span style="font-size:10px; opacity:0.6;">CURRENT HASH:</span>
                <span class="stat-value" id="alpha-current-hash" style="font-size:9px; word-break:break-all; font-family:monospace;">-</span>
            </div>
            <div style="display:flex; gap:6px; margin-top:10px;">
                <button class="load-btn" style="flex:1;" onclick="loadRandomSeed('alpha')">RANDOM SEED</button>
                <button class="load-btn" style="flex:1; background:rgba(0, 255, 255, 0.15); border-color:#00ffff;" onclick="loadDatabaseGlyph('alpha')">DB DRAW</button>
            </div>
            <!-- NEW: Graph Strip Canvas under buttons -->
            <canvas id="alpha-graph-canvas" height="30" style="width: 100%; height: 30px; display: block; margin-top: 6px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 3px;"></canvas>

            <div style="font-size: 9px; color: #888; margin-top: 6px;">SPEED DISTRIBUTION</div>
            <canvas id="alpha-speed-canvas" height="24" style="width: 100%; height: 24px; display: block; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 3px;"></canvas>

            <div style="font-size: 9px; color: #888; margin-top: 4px;">CHARGE DISTRIBUTION (-4 to +4)</div>
            <canvas id="alpha-charge-canvas" height="24" style="width: 100%; height: 24px; display: block; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 3px;"></canvas>

            <div style="font-size: 9px; color: #888; margin-top: 4px;">AGE DISTRIBUTION (SHAKES)</div>
            <canvas id="alpha-age-canvas" height="24" style="width: 100%; height: 24px; display: block; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 3px;"></canvas>
        
        </div>

        <!-- MODULE PALETTE DRAWER (EDIT MODE) -->
        <div class="player-box editor-palette-box" id="editor-panel">
            <div class="pane-title" style="color:#00ffff; border-color:#00ffff;">EDITOR // PALETTE</div>
            <div class="palette-grid">
                <!-- SOURCE ALPHA -->
                <div class="palette-card" draggable="true" data-type="SOURCE_ALPHA">
                    <svg viewBox="0 0 32 32">
                        <rect x="6" y="6" width="20" height="20" stroke="#42f485" stroke-width="1.5" fill="none"/>
                        <circle cx="16" cy="16" r="4" fill="#42f485"/>
                    </svg>
                    <span>SOURCE ALPHA</span>
                </div>

                <!-- SOURCE BETA -->
                <div class="palette-card" draggable="true" data-type="SOURCE_BETA">
                    <svg viewBox="0 0 32 32">
                        <rect x="6" y="6" width="20" height="20" stroke="#00e1ff" stroke-width="1.5" fill="none"/>
                        <circle cx="16" cy="16" r="4" fill="#00e1ff"/>
                    </svg>
                    <span>SOURCE BETA</span>
                </div>
                <!-- ATTRACTOR -->
                <div class="palette-card" draggable="true" data-type="ATTRACTOR">
                    <svg viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="10" stroke="#ff3366" stroke-width="1.5" fill="none"/>
                        <circle cx="16" cy="16" r="3" fill="#ff3366"/>
                    </svg>
                    <span>ATTRACTOR</span>
                </div>
                <!-- SINK -->
                <div class="palette-card" draggable="true" data-type="SINK">
                    <svg viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="11" stroke="#00ffff" stroke-width="1.5" fill="none"/>
                        <circle cx="16" cy="16" r="3" fill="#00ffff"/>
                    </svg>
                    <span>DRAIN SINK</span>
                </div>
                <!-- QCD INVERTER -->
                <div class="palette-card" draggable="true" data-type="QCD_INVERTER">
                    <svg viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="11" stroke="#ff00ff" stroke-width="1.5" stroke-dasharray="3 3" fill="none"/>
                        <path d="M11 16 L21 16 M18 13 L21 16 L18 19" stroke="#ff00ff" stroke-width="1.5" fill="none"/>
                    </svg>
                    <span>QCD INVERT</span>
                </div>
                <!-- DOUBLER -->
                <div class="palette-card" draggable="true" data-type="DOUBLER">
                    <svg viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="12" stroke="#ffbb00" stroke-width="1.5" fill="none"/>
                        <circle cx="16" cy="16" r="6" stroke="#ffbb00" stroke-width="1.5" fill="none"/>
                    </svg>
                    <span>DOUBLER</span>
                </div>
                <!-- CHARGER POS -->
                <div class="palette-card" draggable="true" data-type="CHARGER_POS">
                    <svg viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="11" stroke="#00e1ff" stroke-width="1.5" fill="none"/>
                        <path d="M16 10 V22 M10 16 H22" stroke="#00e1ff" stroke-width="2"/>
                    </svg>
                    <span>+ CHARGER</span>
                </div>
                <!-- CHARGER NEG -->
                <div class="palette-card" draggable="true" data-type="CHARGER_NEG">
                    <svg viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="11" stroke="#ff3366" stroke-width="1.5" fill="none"/>
                        <path d="M10 16 H22" stroke="#ff3366" stroke-width="2"/>
                    </svg>
                    <span>- CHARGER</span>
                </div>
                <!-- CAPACITOR POS -->
                <div class="palette-card" draggable="true" data-type="CAPACITOR_POS">
                    <svg viewBox="0 0 32 32">
                        <path d="M11 8 V24 M21 8 V24" stroke="#00e1ff" stroke-width="2"/>
                        <path d="M14 16 H18" stroke="#00e1ff" stroke-width="1.5"/>
                    </svg>
                    <span>+ CAPACITOR</span>
                </div>
                <!-- CAPACITOR NEG -->
                <div class="palette-card" draggable="true" data-type="CAPACITOR_NEG">
                    <svg viewBox="0 0 32 32">
                        <path d="M11 8 V24 M21 8 V24" stroke="#ff3366" stroke-width="2"/>
                        <path d="M14 16 H18" stroke="#ff3366" stroke-width="1.5"/>
                    </svg>
                    <span>- CAPACITOR</span>
                </div>
                <!-- KINETIC BOOST (Up Arrow) -->
                <div class="palette-card" draggable="true" data-type="KINETIC_BOOST">
                    <svg viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="11" stroke="#ff9900" stroke-width="1.5" fill="none"/>
                        <path d="M10 18 L16 12 L22 18" stroke="#ff9900" stroke-width="2" fill="none"/>
                    </svg>
                    <span>BOOST 2X</span>
                </div>

                <!-- KINETIC SLOW (Down Arrow) -->
                <div class="palette-card" draggable="true" data-type="KINETIC_SLOW">
                    <svg viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="11" stroke="#00bfff" stroke-width="1.5" fill="none"/>
                        <path d="M10 14 L16 20 L22 14" stroke="#00bfff" stroke-width="2" fill="none"/>
                    </svg>
                    <span>SLOW 0.5X</span>
                </div>
                <!-- BRICKS SHIELD -->
                <div class="palette-card" draggable="true" data-type="BRICKS">
                    <svg viewBox="0 0 32 32">
                        <rect x="5" y="5" width="6" height="6" fill="#4a5568"/>
                        <rect x="13" y="5" width="6" height="6" fill="#4a5568"/>
                        <rect x="21" y="5" width="6" height="6" fill="#4a5568"/>
                        <rect x="5" y="13" width="6" height="6" fill="#4a5568"/>
                        <rect x="13" y="13" width="6" height="6" fill="#4a5568"/>
                        <rect x="21" y="13" width="6" height="6" fill="#4a5568"/>
                        <rect x="5" y="21" width="6" height="6" fill="#4a5568"/>
                        <rect x="13" y="21" width="6" height="6" fill="#4a5568"/>
                        <rect x="21" y="21" width="6" height="6" fill="#4a5568"/>
                    </svg>
                    <span>BRICKS</span>
                </div>
                <!-- MAGNETIZER -->
                <div class="palette-card" draggable="true" data-type="MAGNETIZER">
                    <svg viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="11" stroke="#e040fb" stroke-width="1.5" fill="none"/>
                        <path d="M12 10 V18 M20 10 V18 M12 18 C12 22 20 22 20 18" stroke="#e040fb" stroke-width="2" fill="none"/>
                    </svg>
                    <span>MAGNETIZER</span>
                </div>
            </div>
        </div>

        <!-- MAIN ARENA CANVAS -->
        <div class="arena-container">
            <div id="arena-timer" style="
                    position: absolute;
                    top: 12px;
                    left: 50%;
                    transform: translateX(-50%);
                    font-family: monospace;
                    font-size: 22px;
                    font-weight: bold;
                    color: #00ffff;
                    background: rgba(10, 15, 25, 0.75);
                    border: 1px solid rgba(0, 255, 255, 0.4);
                    border-radius: 4px;
                    padding: 4px 14px;
                    letter-spacing: 2px;
                    pointer-events: none;
                    box-shadow: 0 0 10px rgba(0, 255, 255, 0.2);
                    z-index: 10;
                    display: none;
                ">00:00</div>
            <canvas id="physics-canvas"></canvas>

            <!-- GAME OVER SCORECARD OVERLAY -->
            <div id="game-over-overlay" class="game-over-modal">
                <div class="scorecard-header">MATCH TERMINATED // RESULTS</div>
                
                <div class="scorecard-body">
                    <!-- ALPHA GLYPH COLUMN -->
                    <div class="scorecard-card" id="card-alpha">
                        <div class="card-winner-badge" id="badge-alpha">WINNER</div>
                        <div class="card-title">SOURCE :: ALPHA</div>
                        <canvas id="scorecard-alpha-preview" width="64" height="64" class="card-preview"></canvas>
                        <div class="card-info">
                            <span class="info-label">DESIGNATION</span>
                            <span class="info-val" id="scorecard-alpha-name">-</span>
                        </div>
                        <div class="card-info">
                            <span class="info-label">OWNER</span>
                            <span class="info-val" id="scorecard-alpha-owner">-</span>
                        </div>
                        <div class="card-info">
                            <span class="info-label">GENERATIONS</span>
                            <span class="info-val" id="scorecard-alpha-gen">-</span>
                        </div>
                        <div class="card-score-box">
                            <div class="score-label">FINAL SCORE</div>
                            <div class="score-value" id="scorecard-alpha-score">0</div>
                        </div>
                    </div>

                    <div class="vs-divider">VS</div>

                    <!-- BETA GLYPH COLUMN -->
                    <div class="scorecard-card" id="card-beta">
                        <div class="card-winner-badge" id="badge-beta">WINNER</div>
                        <div class="card-title">SOURCE :: BETA</div>
                        <canvas id="scorecard-beta-preview" width="64" height="64" class="card-preview"></canvas>
                        <div class="card-info">
                            <span class="info-label">DESIGNATION</span>
                            <span class="info-val" id="scorecard-beta-name">-</span>
                        </div>
                        <div class="card-info">
                            <span class="info-label">OWNER</span>
                            <span class="info-val" id="scorecard-beta-owner">-</span>
                        </div>
                        <div class="card-info">
                            <span class="info-label">GENERATIONS</span>
                            <span class="info-val" id="scorecard-beta-gen">-</span>
                        </div>
                        <div class="card-score-box">
                            <div class="score-label">FINAL SCORE</div>
                            <div class="score-value" id="scorecard-beta-score">0</div>
                        </div>
                    </div>
                </div>

                <button class="scorecard-dismiss-btn" onclick="dismissGameOver()">CONTINUE</button>
            </div>

        </div>

        <!-- SOURCE MODULE BETA -->
        <div class="player-box" id="beta-panel">
            <div class="pane-title">SOURCE :: BETA</div>
            <div class="glyph-preview">
                <canvas id="glyph-beta-canvas" width="80" height="80"></canvas>
            </div>
            <div class="stat-line">
                <span>DESIGNATION:</span>
                <span class="stat-value" id="beta-name">P_56_10</span>
            </div>
            <div class="stat-line">
                <span>OWNER:</span>
                <span class="stat-value" id="beta-owner" style="color: #00ffff;">-</span>
            </div>
            <div class="stat-line">
                <span>INTRINSIC HUE:</span>
                <span class="stat-value" id="beta-color" style="color: #42f485">#42F485</span>
            </div>
            <div class="stat-line">
                <span>GENERATION:</span>
                <span class="stat-value" id="beta-gen">0 / 500</span>
            </div>
            <div class="stat-line">
                <span>PARTICLES ACTIVE:</span>
                <span class="stat-value" id="beta-particles">0</span>
            </div>
            <div class="stat-line">
                <span>SCORE:</span>
                <span class="stat-value" id="beta-score" style="color:#00ffff; font-weight:bold;">0</span>
            </div>
            <div class="stat-line" style="flex-direction:column; align-items:flex-start; gap:2px;">
                <span style="font-size:10px; opacity:0.6;">ORIGIN HASH:</span>
                <span class="stat-value" id="beta-origin-hash" style="font-size:9px; word-break:break-all; font-family:monospace;">-</span>
            </div>
            <div class="stat-line" style="flex-direction:column; align-items:flex-start; gap:2px;">
                <span style="font-size:10px; opacity:0.6;">CURRENT HASH:</span>
                <span class="stat-value" id="beta-current-hash" style="font-size:9px; word-break:break-all; font-family:monospace;">-</span>
            </div>
            <div style="display:flex; gap:6px; margin-top:10px;">
                <button class="load-btn" style="flex:1;" onclick="loadRandomSeed('beta')">RANDOM SEED</button>
                <button class="load-btn" style="flex:1; background:rgba(0, 255, 255, 0.15); border-color:#00ffff;" onclick="loadDatabaseGlyph('beta')">DB DRAW</button>
            </div>
            <!-- NEW: Graph Strip Canvas under buttons -->
            <canvas id="beta-graph-canvas" height="30" style="width: 100%; height: 30px; display: block; margin-top: 6px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 3px;"></canvas>
        
            <div style="font-size: 9px; color: #888; margin-top: 6px;">SPEED DISTRIBUTION</div>
            <canvas id="beta-speed-canvas" height="24" style="width: 100%; height: 24px; display: block; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 3px;"></canvas>

            <div style="font-size: 9px; color: #888; margin-top: 4px;">CHARGE DISTRIBUTION (-4 to +4)</div>
            <canvas id="beta-charge-canvas" height="24" style="width: 100%; height: 24px; display: block; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 3px;"></canvas>

            <div style="font-size: 9px; color: #888; margin-top: 4px;">AGE DISTRIBUTION (SHAKES)</div>
            <canvas id="beta-age-canvas" height="24" style="width: 100%; height: 24px; display: block; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 3px;"></canvas>
        </div>

        <!-- MECHANICAL MODULE PALETTE DRAWER (EDIT MODE - RIGHT PANEL) -->
        <div class="player-box editor-palette-box" id="editor-panel-mech">
            <div class="pane-title" style="color:#ffaa00; border-color:#ffaa00;">EDITOR // MECHANICS</div>
            <div class="palette-grid">
                <!-- PADDLE WHEEL -->
                <div class="palette-card" draggable="true" data-type="PADDLE_WHEEL">
                    <svg viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="11" stroke="#ffaa00" stroke-width="1.5" fill="none"/>
                        <path d="M16 5 V27 M5 16 H27 M8 8 L24 24 M8 24 L24 8" stroke="#ffaa00" stroke-width="1.2"/>
                        <circle cx="16" cy="16" r="3" fill="#ffaa00"/>
                    </svg>
                    <span>PADDLE WHEEL</span>
                </div>

                <!-- WEDGE (BOTTOM-LEFT) -->
                <div class="palette-card" draggable="true" data-type="WEDGE_BL">
                    <svg viewBox="0 0 32 32">
                        <polygon points="6,26 26,26 6,6" fill="rgba(255, 170, 0, 0.4)" stroke="#ffaa00" stroke-width="1.5"/>
                    </svg>
                    <span>WEDGE (BL)</span>
                </div>

                <!-- WEDGE (TOP-LEFT) -->
                <div class="palette-card" draggable="true" data-type="WEDGE_TL">
                    <svg viewBox="0 0 32 32">
                        <polygon points="6,6 26,6 6,26" fill="rgba(255, 170, 0, 0.4)" stroke="#ffaa00" stroke-width="1.5"/>
                    </svg>
                    <span>WEDGE (TL)</span>
                </div>

                <!-- WEDGE (TOP-RIGHT) -->
                <div class="palette-card" draggable="true" data-type="WEDGE_TR">
                    <svg viewBox="0 0 32 32">
                        <polygon points="26,6 26,26 6,6" fill="rgba(255, 170, 0, 0.4)" stroke="#ffaa00" stroke-width="1.5"/>
                    </svg>
                    <span>WEDGE (TR)</span>
                </div>

                <!-- WEDGE (BOTTOM-RIGHT) -->
                <div class="palette-card" draggable="true" data-type="WEDGE_BR">
                    <svg viewBox="0 0 32 32">
                        <polygon points="26,26 6,26 26,6" fill="rgba(255, 170, 0, 0.4)" stroke="#ffaa00" stroke-width="1.5"/>
                    </svg>
                    <span>WEDGE (BR)</span>
                </div>

                <!-- BLOCK SMALL -->
                <div class="palette-card" draggable="true" data-type="BLOCK_SMALL">
                    <svg viewBox="0 0 32 32">
                        <rect x="10" y="10" width="12" height="12" fill="rgba(255, 170, 0, 0.4)" stroke="#ffaa00" stroke-width="1.5"/>
                    </svg>
                    <span>BLOCK (S)</span>
                </div>

                <!-- BLOCK STANDARD -->
                <div class="palette-card" draggable="true" data-type="BLOCK">
                    <svg viewBox="0 0 32 32">
                        <rect x="6" y="6" width="20" height="20" fill="rgba(255, 170, 0, 0.4)" stroke="#ffaa00" stroke-width="1.5"/>
                    </svg>
                    <span>BLOCK (M)</span>
                </div>

                <!-- BAR HORIZONTAL -->
                <div class="palette-card" draggable="true" data-type="BAR_H">
                    <svg viewBox="0 0 32 32">
                        <rect x="11" y="6" width="10" height="20" fill="rgba(255, 170, 0, 0.4)" stroke="#ffaa00" stroke-width="1.5"/>
                    </svg>
                    <span>BAR (H)</span>
                </div>

                <!-- BAR VERTICAL -->
                <div class="palette-card" draggable="true" data-type="BAR_V">
                    <svg viewBox="0 0 32 32">
                        <rect x="6" y="11" width="20" height="10" fill="rgba(255, 170, 0, 0.4)" stroke="#ffaa00" stroke-width="1.5"/>
                    </svg>
                    <span>BAR (V)</span>
                </div>

            </div>
        </div>

    </div>

    <div class="controls-bar">
        <button class="help-btn" onclick="clearArena()">&lt;|</button>
        <button class="start-btn pulse-green" id="sim-btn" onclick="toggleSimulation()">|&gt;</button>
        <button class="help-btn" id="edit-mode-btn" onclick="toggleEditMode()">EDIT MODE: OFF</button>
        <button class="help-btn" id="global-gravity-btn" onclick="toggleGlobalGravity()">GRAVITY DOWN: OFF</button>
        
        <!-- Gravity Slider -->
        <div style="display:flex; align-items:center; gap:10px; color:#fff; font-family:monospace; font-size:11px;">
            <label for="gravity-slider">GRAVITY WELL:</label>
            <input type="range" id="gravity-slider" min="-20000000" max="20000000" step="1000000" value="10000" oninput="updateGravity(this.value)">
            <span id="gravity-val">10000</span>
        </div>

        <!-- Capacitor Strength Slider -->
        <div style="display:flex; align-items:center; gap:10px; color:#fff; font-family:monospace; font-size:11px;">
            <label for="capacitor-slider">CAPACITOR FORCE:</label>
            <input type="range" id="capacitor-slider" min="0" max="100000" step="5000" value="18000" oninput="updateCapacitorStrength(this.value)">
            <span id="capacitor-val">18000</span>
        </div>

        <!-- Boundary Mode Selector Button -->
        <button class="help-btn" id="boundary-btn" onclick="cycleBoundaryMode()" style="min-width: 170px;">BOUNDARIES: NONE</button>

        <!-- MATCH TIMEOUT & OVERTIME RESOLUTION SELECTORS -->
        <div style="display:flex; align-items:center; gap:6px; color:#fff; font-family:monospace; font-size:11px; margin-left: 8px;">
            <label for="timer-select">LIMIT:</label>
            <select id="timer-select" onchange="resetMatchTimer()" style="background:#0f141e; color:#42f485; border:1px solid rgba(66,244,133,0.3); padding:3px 6px; font-family:monospace; font-size:11px; border-radius:3px; cursor:pointer;">
                <option value="0">OFF</option>
                <option value="300">5 MIN</option>
                <option value="600">10 MIN</option>
                <option value="900">15 MIN</option>
            </select>
            
            <label for="action-select" style="margin-left:4px;">TRIGGER:</label>
            <select id="action-select" style="background:#0f141e; color:#00ffff; border:1px solid rgba(0,255,255,0.3); padding:3px 6px; font-family:monospace; font-size:11px; border-radius:3px; cursor:pointer;">
                <option value="GRAVITY">MAX GRAVITY</option>
                <option value="GEOMETRY">NO BOUNDARIES</option>
            </select>
        </div>
    </div>
</div>

<script>
    const databaseGlyphs = <?php echo json_encode($myGlyphs ?: []); ?>;
    const canvas = document.getElementById('physics-canvas');
    let isRunning = false;

    let matchTimeRemaining = 0; // seconds remaining
    let lastTimerTick = performance.now();
    let timerExpired = false;

    const alphaEngine = new LifeEngine('glyph-alpha-canvas', 16);
    const betaEngine  = new LifeEngine('glyph-beta-canvas', 16);
    const arena       = new ArenaManager('physics-canvas');
    const scores = { alphaScore: 0, betaScore: 0 };

    function getRandomDatabaseGlyph() {
        if (!databaseGlyphs || databaseGlyphs.length === 0) return null;
        const randomIndex = Math.floor(Math.random() * databaseGlyphs.length);
        return databaseGlyphs[randomIndex];
    }

    function loadInitialGlyphs() {
        if (databaseGlyphs.length > 0) {
            const alphaData = databaseGlyphs[0];
            alphaEngine.loadFromBinary(alphaData.BIN, parseInt(alphaData.GENERATIONS) || 500);
            document.getElementById('alpha-name').innerText = alphaData.BATTLE_NAME;
            document.getElementById('alpha-owner').innerText = alphaData.OWNER || 'SYSTEM';
        } else {
            alphaEngine.loadFromBinary(getRandomBinary(256), 500);
            document.getElementById('alpha-owner').innerText = 'SYSTEM';
        }

        if (databaseGlyphs.length > 1) {
            const betaData = databaseGlyphs[1];
            betaEngine.loadFromBinary(betaData.BIN, parseInt(betaData.GENERATIONS) || 500);
            document.getElementById('beta-name').innerText = betaData.BATTLE_NAME;
            document.getElementById('beta-owner').innerText = betaData.OWNER || 'SYSTEM';
        } else {
            betaEngine.loadFromBinary(getRandomBinary(256), 500);
            document.getElementById('beta-owner').innerText = 'SYSTEM';
        }

        updateGlyphColorStyling('alpha', alphaEngine.intrinsicColor);
        document.getElementById('alpha-color').innerText   = alphaEngine.intrinsicColor.toUpperCase();

        updateGlyphColorStyling('beta', betaEngine.intrinsicColor);
        document.getElementById('beta-color').innerText    = betaEngine.intrinsicColor.toUpperCase();

        const modWidth = 80;
        const modHeight = 80;
        const padding = 20;

        const stageWidth = canvas.width || 800;
        const stageHeight = canvas.height || 600;

        const centerY = (stageHeight / 2) - (modHeight / 2);
        const centerX = (stageWidth / 2) - (modWidth / 2);

        const alphaX = padding;
        const betaX  = stageWidth - modWidth - padding;

        /*
        arena.addModule(new SourceSpawnModule('alpha_src', alphaX, centerY, modWidth, modHeight, alphaEngine, 'ALPHA'));
        arena.addModule(new SourceSpawnModule('beta_src', betaX, centerY, modWidth, modHeight, betaEngine, 'BETA'));
        
        arena.addModule(new SinkModule('center_sink', centerX, centerY, modWidth, modHeight, scores));
        */

        const verticalOffset = 150;
        const currentGravity = parseFloat(document.getElementById('gravity-slider').value) || 8000;

        /*
        arena.addModule(new AttractorModule('gravity_top', centerX, centerY - verticalOffset, modWidth, modHeight, currentGravity));
        arena.addModule(new AttractorModule('gravity_bottom', centerX, centerY + verticalOffset, modWidth, modHeight, currentGravity));
        */

        const horizontalOffset = 160;
        /*
        arena.addModule(new QCDInverterModule('qcd_left', centerX - horizontalOffset, centerY, modWidth, modHeight));
        arena.addModule(new QCDInverterModule('qcd_right', centerX + horizontalOffset, centerY, modWidth, modHeight));

        arena.addModule(new DoublerModule('doubler_top', centerX - horizontalOffset, centerY - verticalOffset, modWidth, modHeight));
        arena.addModule(new DoublerModule('doubler_bottom', centerX + horizontalOffset, centerY + verticalOffset, modWidth, modHeight));  
        
        arena.addModule(new ChargerModule('charger_pos', centerX - horizontalOffset, centerY + verticalOffset, modWidth, modHeight, +1));
        arena.addModule(new ChargerModule('charger_neg', centerX + horizontalOffset, centerY - verticalOffset, modWidth, modHeight, -1));
        */

        const currentCapacitorStrength = parseFloat(document.getElementById('capacitor-slider').value) || 18000;
        /*
        arena.addModule(new CapacitorModule('cap_pos', centerX - horizontalOffset, centerY + verticalOffset * 0.5, modWidth, modHeight, 4, currentCapacitorStrength));
        arena.addModule(new CapacitorModule('cap_neg', centerX + horizontalOffset, centerY - verticalOffset * 0.5, modWidth, modHeight, -4, currentCapacitorStrength));

        arena.addModule(new KineticConverterModule('kinetic_fast', centerX - horizontalOffset, centerY - verticalOffset * 0.5, modWidth, modHeight, 'double'));
        arena.addModule(new KineticConverterModule('kinetic_slow', centerX + horizontalOffset, centerY + verticalOffset * 0.5, modWidth, modHeight, 'half'));
        */

    }

    function getRandomBinary(length) {
        return Array.from({ length }, () => (Math.random() > 0.7 ? '1' : '0')).join('');
    }

    function resizeCanvas() {
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        alphaEngine.resize();
        betaEngine.resize();
    }
    
    const resizeObserver = new ResizeObserver(() => resizeCanvas());
    resizeObserver.observe(canvas.parentElement);

    resizeCanvas();
    loadInitialGlyphs();

    function updateHUD() {
        const alphaMaxStr = alphaEngine.maxGenerations === Infinity ? '?' : alphaEngine.maxGenerations;
        const betaMaxStr  = betaEngine.maxGenerations  === Infinity ? '?' : betaEngine.maxGenerations;

        document.getElementById('alpha-gen').innerText = `${alphaEngine.iteration} / ${alphaMaxStr}`;
        document.getElementById('beta-gen').innerText  = `${betaEngine.iteration} / ${betaMaxStr}`;

        const alphaCount = arena.particles.filter(p => p.sourceId && p.sourceId.includes('alpha')).length;
        const betaCount  = arena.particles.filter(p => p.sourceId && p.sourceId.includes('beta')).length;
        document.getElementById('alpha-particles').innerText = alphaCount;
        document.getElementById('beta-particles').innerText  = betaCount;

        document.getElementById('alpha-score').innerText = scores.alphaScore;
        document.getElementById('beta-score').innerText  = scores.betaScore;

        document.getElementById('alpha-origin-hash').innerText  = alphaEngine.originHash  || '-';
        document.getElementById('alpha-current-hash').innerText = alphaEngine.currentHash || '-';
        document.getElementById('beta-origin-hash').innerText   = betaEngine.originHash   || '-';
        document.getElementById('beta-current-hash').innerText  = betaEngine.currentHash  || '-';

        updateMetricBars();
        updateGraphStrips();
        updateHistogramStrips();
    }

    let frameCount = 0;
    let lastFpsUpdate = performance.now();

    function checkTerminationConditions() {
        if (!isRunning) return false;

        // Check if both LifeEngines have reached static/cyclic halting state or max gens
        const alphaHalted = alphaEngine.isHalted || !alphaEngine.isActive || alphaEngine.iteration >= alphaEngine.maxGenerations;
        const betaHalted  = betaEngine.isHalted  || !betaEngine.isActive  || betaEngine.iteration >= betaEngine.maxGenerations;

        // Check if all particles have cleared the arena
        const noParticles = arena.particles.length === 0;

        return alphaHalted && betaHalted && noParticles;
    }

    function loop() {
        if (isRunning) {
            arena.updateAndRender();
            alphaEngine.render();
            betaEngine.render();
            updateHUD();

            // Check for Game Over condition match
            if (checkTerminationConditions()) {
                triggerGameOver();
                return;
            }

            // MATCH TIMER TICK LOGIC
            if (matchTimeRemaining > 0 && !timerExpired) {
                const now = performance.now();
                const deltaSecs = (now - lastTimerTick) / 1000;
                matchTimeRemaining -= deltaSecs;

                if (matchTimeRemaining <= 0) {
                    matchTimeRemaining = 0;
                    executeTimeUpAction();
                } else {
                    updateTimerDisplay();
                }
            }
            lastTimerTick = performance.now();

            frameCount++;
            const now = performance.now();
            if (now - lastFpsUpdate >= 500) {
                const fps = Math.round((frameCount * 1000) / (now - lastFpsUpdate));
                document.getElementById('fps-counter').innerText = fps;
                frameCount = 0;
                lastFpsUpdate = now;
            }
        } else {
            lastTimerTick = performance.now(); // Reset delta anchor when paused
            arena.renderOnly();
        }
        requestAnimationFrame(loop);
    }
    loop();

    function toggleSimulation() {
        isRunning = !isRunning;
        const btn = document.getElementById('sim-btn');
        btn.innerText = isRunning ? "||" : "|>";
        btn.classList.toggle('pulse-green', !isRunning);
    }

    function clearArena() {
        // 1. Reset particles and arena scores
        arena.particles = [];
        scores.alphaScore = 0;
        scores.betaScore = 0;

        // 2. Reset GOL engines to starting configuration
        alphaEngine.resetToInitial();
        betaEngine.resetToInitial();

        // Reset histories
        historyAlpha.length = 0;
        historyBeta.length = 0;

        resetMatchTimer();

        // 3. Update interface state
        updateHUD();
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function loadRandomSeed(source) {
        const targetEngine = source === 'alpha' ? alphaEngine : betaEngine;
        const prefix = source === 'alpha' ? 'alpha' : 'beta';

        const randomBin = getRandomBinary(256);
        targetEngine.loadFromBinary(randomBin, Infinity);

        document.getElementById(`${prefix}-name`).innerText = `RAND_${Math.floor(Math.random() * 8999 + 1000)}`;
        document.getElementById(`${prefix}-owner`).innerText = 'PROCEDURAL';
        updateGlyphColorStyling(source, targetEngine.intrinsicColor);
        document.getElementById(`${prefix}-color`).innerText   = targetEngine.intrinsicColor.toUpperCase();

        targetEngine.render();
        updateHUD();
    }

    function loadDatabaseGlyph(source) {
        if (!databaseGlyphs || databaseGlyphs.length === 0) {
            alert("No registered database Glyphs available!");
            return;
        }

        const targetEngine = source === 'alpha' ? alphaEngine : betaEngine;
        const prefix = source === 'alpha' ? 'alpha' : 'beta';

        const randomDbGlyph = getRandomDatabaseGlyph();
        targetEngine.loadFromBinary(randomDbGlyph.BIN, parseInt(randomDbGlyph.GENERATIONS) || 500);

        document.getElementById(`${prefix}-name`).innerText = randomDbGlyph.BATTLE_NAME;
        document.getElementById(`${prefix}-owner`).innerText = randomDbGlyph.OWNER || 'SYSTEM';
        updateGlyphColorStyling(source, targetEngine.intrinsicColor);
        document.getElementById(`${prefix}-color`).innerText   = targetEngine.intrinsicColor.toUpperCase();

        targetEngine.render();
        updateHUD();
    }

    function updateGravity(value) {
        const val = parseFloat(value);
        document.getElementById('gravity-val').innerText = val;

        // Iterate through all placed modules in the arena
        arena.modules.forEach(mod => {
            if (mod.type === 'ATTRACTOR') {
                mod.strength = val;
            }
        });

        // Re-render canvas immediately if the engine is currently paused
        if (!isRunning) {
            arena.renderOnly();
        }
    }

    function updateCapacitorStrength(value) {
        const val = parseFloat(value);
        document.getElementById('capacitor-val').innerText = val;

        arena.modules.forEach(mod => {
            if (mod.type === 'CAPACITOR') {
                mod.strength = val;
            }
        });

        // Re-render immediately if the simulation is paused
        if (!isRunning) {
            arena.renderOnly();
        }
    }

    function cycleBoundaryMode() {
        const modes = ['none', 'toroidal', 'box'];
        const labels = {
            'none': 'BOUNDARIES: NONE',
            'toroidal': 'BOUNDARIES: TOROIDAL',
            'box': 'BOUNDARIES: SOLID BOX'
        };

        const currentIndex = modes.indexOf(arena.boundaryMode);
        const nextMode = modes[(currentIndex + 1) % modes.length];

        arena.boundaryMode = nextMode;
        document.getElementById('boundary-btn').innerText = labels[nextMode];
    }

    function toggleGlobalGravity() {
        arena.globalGravityEnabled = !arena.globalGravityEnabled;
        const btn = document.getElementById('global-gravity-btn');
        
        if (arena.globalGravityEnabled) {
            btn.innerText = "GRAVITY DOWN: ON";
            btn.style.borderColor = "#42f485";
            btn.style.color = "#42f485";
        } else {
            btn.innerText = "GRAVITY DOWN: OFF";
            btn.style.borderColor = "";
            btn.style.color = "";
        }
    }

    // Toggle Panel between Source Alpha & Palette
    window.isEditMode = false;
    let moduleCounter = 0;

    function toggleEditMode() {
        window.isEditMode = !window.isEditMode;
        const btn = document.getElementById('edit-mode-btn');
        
        // Panel elements
        const alphaPanel = document.getElementById('alpha-panel');
        const editorPanelLeft = document.getElementById('editor-panel');
        const betaPanel = document.getElementById('beta-panel');
        const editorPanelRight= document.getElementById('editor-panel-mech');

        if (window.isEditMode) {
            btn.innerText = "EDIT MODE: ON";
            btn.style.borderColor = "#00ffff";
            btn.style.color = "#00ffff";

            // Swap Left: Alpha -> Physics Palette
            alphaPanel.style.display = "none";
            editorPanelLeft.style.display = "flex";

            // Swap Right: Beta -> Mechanics Palette
            if (betaPanel) betaPanel.style.display = "none";
            if (editorPanelRight) editorPanelRight.style.display = "flex";
        } else {
            btn.innerText = "EDIT MODE: OFF";
            btn.style.borderColor = "";
            btn.style.color = "";

            // Restore Left: Physics Palette -> Alpha
            editorPanelLeft.style.display = "none";
            alphaPanel.style.display = "flex";

            // Restore Right: Mechanics Palette -> Beta
            if (editorPanelRight) editorPanelRight.style.display = "none";
            if (betaPanel) betaPanel.style.display = "flex";
        }
        
        // Force immediate canvas re-render when toggling while paused
        if (!isRunning) {
            arena.renderOnly();
        }
    }

    function toggleEditModeOLD() {
        window.isEditMode = !window.isEditMode; // Bind directly to window
        const btn = document.getElementById('edit-mode-btn');
        const alphaPanel = document.getElementById('alpha-panel');
        const editorPanel = document.getElementById('editor-panel');

        if (window.isEditMode) {
            btn.innerText = "EDIT MODE: ON";
            btn.style.borderColor = "#00ffff";
            btn.style.color = "#00ffff";

            // Hide Alpha, Show Palette
            alphaPanel.style.display = "none";
            editorPanel.style.display = "flex";
        } else {
            btn.innerText = "EDIT MODE: OFF";
            btn.style.borderColor = "";
            btn.style.color = "";

            // Restore Alpha Panel
            editorPanel.style.display = "none";
            alphaPanel.style.display = "flex";
        }
        
        // Force a re-render frame immediately on toggle
        if (!isRunning) {
            arena.renderOnly();
        }
    }

    function createModuleByType(type, id, x, y, width = 80, height = 80) {
        const currentGravity = parseFloat(document.getElementById('gravity-slider').value) || 8000;
        const currentCap = parseFloat(document.getElementById('capacitor-slider').value) || 18000;

        switch (type) {
            case 'SOURCE_ALPHA':
                return new SourceSpawnModule(id || 'alpha_src', x, y, width, height, alphaEngine, 'ALPHA');
            case 'SOURCE_BETA':
                return new SourceSpawnModule(id || 'beta_src', x, y, width, height, betaEngine, 'BETA');
            case 'ATTRACTOR':
                return new AttractorModule(id, x, y, width, height, currentGravity);
            case 'SINK':
                return new SinkModule(id, x, y, width, height, scores);
            case 'QCD_INVERTER':
                return new QCDInverterModule(id, x, y, width, height);
            case 'DOUBLER':
                return new DoublerModule(id, x, y, width, height);
            case 'CHARGER_POS':
                return new ChargerModule(id, x, y, width, height, 1);
            case 'CHARGER_NEG':
                return new ChargerModule(id, x, y, width, height, -1);
            case 'CAPACITOR_POS':
                return new CapacitorModule(id, x, y, width, height, 4, currentCap);
            case 'CAPACITOR_NEG':
                return new CapacitorModule(id, x, y, width, height, -4, currentCap);
            case 'KINETIC_BOOST':
                return new KineticConverterModule(id, x, y, width, height, 'double');
            case 'KINETIC_SLOW':
                return new KineticConverterModule(id, x, y, width, height, 'half');
            case 'BRICKS':
                return new BricksModule(id, x, y, width, height, 0);
            case 'MAGNETIZER':
                return new MagnetizerModule(id, x, y, width, height);
            case 'PADDLE_WHEEL':
                return new PaddleWheelModule(id, x, y, width, height, 2, 1);
            case 'WEDGE_BL':
                return new WedgeModule(id, x, y, width/2, height/2, 'BL');
            case 'WEDGE_TL':
                return new WedgeModule(id, x, y, width/2, height/2, 'TL');
            case 'WEDGE_TR':
                return new WedgeModule(id, x, y, width/2, height/2, 'TR');
            case 'WEDGE_BR':
                return new WedgeModule(id, x, y, width/2, height/2, 'BR');
            case 'BLOCK_SMALL':
                return new BlockSmallModule(id, x, y, 40, 40);
            case 'BLOCK':
                return new BlockModule(id, x, y, 80, 80);
            case 'BAR_H':
                return new BarHModule(id, x, y, 20, 80);
            case 'BAR_V':
                return new BarVModule(id, x, y, 80, 20);
            default:
                return null;
        }
    }

    function setupPaletteDragAndDrop() {
        const paletteCards = document.querySelectorAll('.palette-card');

        paletteCards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', card.dataset.type);
                e.dataTransfer.effectAllowed = 'copy';
            });
        });

        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            const type = e.dataTransfer.getData('text/plain');
            if (!type) return;

            const rect = canvas.getBoundingClientRect();
            
            const isGranular = type.startsWith('CUSTOM_') || type.startsWith('WEDGE_') || type === 'BLOCK_SMALL';
            const isBarH = type === 'BAR_H';
            const isBarV = type === 'BAR_V';

            let modWidth = 80;
            let modHeight = 80;

            if (isGranular) {
                modWidth = 40;
                modHeight = 40;
            } else if (isBarH) {
                modWidth = 20;
                modHeight = 80;
            } else if (isBarV) {
                modWidth = 80;
                modHeight = 20;
            }

            let dropX = e.clientX - rect.left - (modWidth / 2);
            let dropY = e.clientY - rect.top - (modHeight / 2);

            // Snap cleanly to fine grid (20px steps)
            const grid = arena.getGridDimensions(80, 4);
            dropX = Math.round(dropX / grid.secondaryStepX) * grid.secondaryStepX;
            dropY = Math.round(dropY / grid.secondaryStepY) * grid.secondaryStepY;

            dropX = Math.max(0, Math.min(canvas.width - modWidth, dropX));
            dropY = Math.max(0, Math.min(canvas.height - modHeight, dropY));

            const uniqueId = `custom_${type.toLowerCase()}_${Date.now()}_${moduleCounter++}`;
            const newModule = createModuleByType(type, uniqueId, dropX, dropY, modWidth, modHeight);

            if (newModule) {
                arena.addModule(newModule);
                if (!isRunning) arena.renderOnly();
            }
        });

    }

    setupPaletteDragAndDrop();

    // --- PHASE 1: CANVAS SELECTION & DRAGGING ---
    let selectedModule = null;
    let isDraggingModule = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    canvas.addEventListener('mousedown', (e) => {
        // Only allow selecting/dragging modules when Edit Mode is active
        if (!window.isEditMode) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Search backwards so top-most/last-added modules are selected first
        let clickedModule = null;
        const modulesArray = Array.from(arena.modules.values());
        
        for (let i = modulesArray.length - 1; i >= 0; i--) {
            const mod = modulesArray[i];
            // Check bounding box hit
            if (mouseX >= mod.x && mouseX <= mod.x + mod.width &&
                mouseY >= mod.y && mouseY <= mod.y + mod.height) {
                clickedModule = mod;
                break;
            }
        }

        if (clickedModule) {
            selectedModule = clickedModule;
            isDraggingModule = true;
            
            // Calculate offset so module doesn't snap its top-left corner to cursor on click
            dragOffsetX = mouseX - selectedModule.x;
            dragOffsetY = mouseY - selectedModule.y;
        } else {
            // Clicked on empty canvas space
            selectedModule = null;
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDraggingModule || !selectedModule) return;

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        let rawX = mouseX - dragOffsetX;
        let rawY = mouseY - dragOffsetY;

        // Dynamic grid snapping based on responsive screen divisions
        const grid = arena.getGridDimensions(80, 4);
        let newX = Math.round(rawX / grid.secondaryStepX) * grid.secondaryStepX;
        let newY = Math.round(rawY / grid.secondaryStepY) * grid.secondaryStepY;

        newX = Math.max(0, Math.min(canvas.width - selectedModule.width, newX));
        newY = Math.max(0, Math.min(canvas.height - selectedModule.height, newY));

        selectedModule.x = newX;
        selectedModule.y = newY;

        // Ensure sub-elements (like Bricks) update their internal positions immediately
        selectedModule.update(0, arena);

        // Re-render frame immediately if engine is paused
        if (!isRunning) {
            arena.renderOnly();
        }
    });

    window.addEventListener('mouseup', () => {
        isDraggingModule = false;
    });

    window.addEventListener('keydown', (e) => {
        // Prevent backspace from navigating back in browser when a module is selected
        if (window.isEditMode && selectedModule && (e.key === 'Delete' || e.key === 'Backspace')) {
            e.preventDefault();
            
            // Prevent accidental deletion of main source emitters
            if (selectedModule.type !== 'SOURCE_SPAWN') {
                arena.removeModule(selectedModule);
                selectedModule = null;

                if (!isRunning) {
                    arena.renderOnly();
                }
            }
        }
    });

    canvas.addEventListener('contextmenu', (e) => {
        if (!window.isEditMode) return;
        
        // Prevent native browser context menu from appearing
        e.preventDefault();

        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const modulesArray = Array.from(arena.modules.values());
        for (let i = modulesArray.length - 1; i >= 0; i--) {
            const mod = modulesArray[i];
            if (mouseX >= mod.x && mouseX <= mod.x + mod.width &&
                mouseY >= mod.y && mouseY <= mod.y + mod.height) {
                
                // Do not delete source spawn emitters
                if (mod.type !== 'SOURCE_SPAWN') {
                    arena.removeModule(mod);
                    if (selectedModule === mod) {
                        selectedModule = null;
                    }
                    if (!isRunning) {
                        arena.renderOnly();
                    }
                }
                break;
            }
        }
    });

    // 1. References for the metric canvases
    const scoreCanvas = document.getElementById('score-bar-canvas');
    const particleCanvas = document.getElementById('particle-bar-canvas');
    const scoreCtx = scoreCanvas.getContext('2d');
    const particleCtx = particleCanvas.getContext('2d');

    // 2. Keep metric canvas resolution crisp on resize
    function resizeMetricBars() {
        const rect = scoreCanvas.getBoundingClientRect();
        scoreCanvas.width = rect.width;
        particleCanvas.width = rect.width;
    }

    // Add metric bar resizing to the existing observer/resize routine
    const metricResizeObserver = new ResizeObserver(() => resizeMetricBars());
    metricResizeObserver.observe(scoreCanvas.parentElement);
    resizeMetricBars();

    // 3. Render function for center-expanding proportional bars with mid-point markers
    function renderMetricBar(ctx, width, height, valAlpha, valBeta, colorAlpha, colorBeta) {
        ctx.clearRect(0, 0, width, height);

        const totalVal = valAlpha + valBeta;
        
        // Always draw subtle background mid-point tick line (1px wide)
        const midX = Math.floor(width / 2);

        if (totalVal > 0) {
            // Determine proportions
            const ratioAlpha = valAlpha / totalVal;
            const ratioBeta = valBeta / totalVal;

            let barWidth = width;

            // Scale outward from the center if below threshold (1000)
            if (totalVal < 1000) {
                barWidth = (totalVal / 1000) * width;
            }

            const alphaWidth = barWidth * ratioAlpha;
            const betaWidth = barWidth * ratioBeta;

            // Center alignment offsets
            const startX = (width - barWidth) / 2;

            // Render Left/Alpha Segment
            if (alphaWidth > 0) {
                ctx.fillStyle = colorAlpha;
                ctx.fillRect(startX, 0, alphaWidth, height);
            }

            // Render Right/Beta Segment
            if (betaWidth > 0) {
                ctx.fillStyle = colorBeta;
                ctx.fillRect(startX + alphaWidth, 0, betaWidth, height);
            }
        }

        // Render Mid-Point Indicator Notch
        // Uses a semi-transparent high-contrast line to stand out against colored or dark backgrounds
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(midX, 0, 1, height);
    }

    // 4. Update HUD Loop Integration
    // (Incorporate these calls into your existing updateHUD() function)
    function updateMetricBars() {
        const alphaCount = arena.particles.filter(p => p.sourceId && p.sourceId.includes('alpha')).length;
        const betaCount  = arena.particles.filter(p => p.sourceId && p.sourceId.includes('beta')).length;

        const colorAlpha = alphaEngine.intrinsicColor;
        const colorBeta  = betaEngine.intrinsicColor;

        // Render Top Bar: Scores (4px)
        renderMetricBar(
            scoreCtx, 
            scoreCanvas.width, 
            4, 
            Math.max(0, scores.alphaScore), 
            Math.max(0, scores.betaScore), 
            colorAlpha, 
            colorBeta
        );

        // Render Bottom Bar: Particle Count (2px)
        renderMetricBar(
            particleCtx, 
            particleCanvas.width, 
            2, 
            alphaCount, 
            betaCount, 
            colorAlpha, 
            colorBeta
        );
    }

    // --- GRAPH HISTORIES AND RENDER ENGINE ---
    const alphaGraphCanvas = document.getElementById('alpha-graph-canvas');
    const betaGraphCanvas  = document.getElementById('beta-graph-canvas');
    const alphaGraphCtx    = alphaGraphCanvas.getContext('2d');
    const betaGraphCtx     = betaGraphCanvas.getContext('2d');

    // Retain full historical lifecycle without fixed sliding limits
    const historyAlpha = [];
    const historyBeta  = [];

    function resizeGraphStrips() {
        const rectA = alphaGraphCanvas.getBoundingClientRect();
        if (rectA.width > 0) alphaGraphCanvas.width = rectA.width;

        const rectB = betaGraphCanvas.getBoundingClientRect();
        if (rectB.width > 0) betaGraphCanvas.width = rectB.width;
    }

    const graphResizeObserver = new ResizeObserver(() => resizeGraphStrips());
    graphResizeObserver.observe(alphaGraphCanvas.parentElement);
    graphResizeObserver.observe(betaGraphCanvas.parentElement);
    resizeGraphStrips();

    function updateGraphStrips() {
        // Compute active counts for particles vs anti-particles per module
        const alphaP    = arena.particles.filter(p => p.sourceId && p.sourceId.includes('alpha') && (p.charge >= 0 || p.charge === undefined)).length;
        const alphaAnti = arena.particles.filter(p => p.sourceId && p.sourceId.includes('alpha') && p.charge < 0).length;

        const betaP    = arena.particles.filter(p => p.sourceId && p.sourceId.includes('beta') && (p.charge >= 0 || p.charge === undefined)).length;
        const betaAnti = arena.particles.filter(p => p.sourceId && p.sourceId.includes('beta') && p.charge < 0).length;

        historyAlpha.push({ particles: alphaP, antiParticles: alphaAnti });
        historyBeta.push({ particles: betaP, antiParticles: betaAnti });

        renderStripGraph(alphaGraphCtx, alphaGraphCanvas.width, 30, historyAlpha, alphaEngine.intrinsicColor, alphaEngine.maxGenerations);
        renderStripGraph(betaGraphCtx, betaGraphCanvas.width, 30, historyBeta, betaEngine.intrinsicColor, betaEngine.maxGenerations);
    }

    function renderStripGraph(ctx, width, height, historyData, baseColor, maxGenerations) {
        ctx.clearRect(0, 0, width, height);

        // Subtle zero-line axis marker
        const midY = height / 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(width, midY);
        ctx.stroke();

        if (historyData.length < 2) return;

        // Determine horizontal domain (targetMax)
        let targetMax = maxGenerations;
        if (targetMax === Infinity || !targetMax) {
            // Initial window 500; scale dynamically if runtime exceeds 500
            targetMax = Math.max(500, historyData.length);
        }

        const stepX = width / Math.max(1, targetMax - 1);

        // Auto-scaling limit for Y-axis (particles vs anti-particles)
        let maxP = 10;
        let maxAnti = 10;
        historyData.forEach(d => {
            if (d.particles > maxP) maxP = d.particles;
            if (d.antiParticles > maxAnti) maxAnti = d.antiParticles;
        });

        // 1. Solid Filled Upper Graph: Particles (Growing Upwards from midY)
        ctx.fillStyle = baseColor;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.moveTo(0, midY);

        for (let i = 0; i < historyData.length; i++) {
            const x = i * stepX;
            const valNorm = historyData[i].particles / maxP;
            const y = midY - (valNorm * (midY - 2)); 
            ctx.lineTo(x, y);
        }

        const lastX = (historyData.length - 1) * stepX;
        ctx.lineTo(lastX, midY);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // Solid top outline for upper curve
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i < historyData.length; i++) {
            const x = i * stepX;
            const valNorm = historyData[i].particles / maxP;
            const y = midY - (valNorm * (midY - 2));
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // 2. Outline Graph Line: Anti-Particles (Growing Downwards from midY)
        ctx.strokeStyle = '#ff3366';
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        for (let i = 0; i < historyData.length; i++) {
            const x = i * stepX;
            const valNorm = historyData[i].antiParticles / maxAnti;
            const y = midY + (valNorm * (height - midY - 2)); 
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
    }

    // Generic Barchart Histogram Renderer
    function renderDistributionHistogram(canvasId, bins, baseColor) {
        const cvs = document.getElementById(canvasId);
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        const w = cvs.width;
        const h = cvs.height;

        ctx.clearRect(0, 0, w, h);
        if (bins.length === 0) return;

        const maxVal = Math.max(1, ...bins);
        const barWidth = w / bins.length;

        for (let i = 0; i < bins.length; i++) {
            const valRatio = bins[i] / maxVal;
            const barHeight = valRatio * (h - 2);
            const x = i * barWidth;
            const y = h - barHeight;

            ctx.fillStyle = baseColor;
            ctx.globalAlpha = 0.7;
            ctx.fillRect(x + 1, y, Math.max(1, barWidth - 2), barHeight);
        }
        ctx.globalAlpha = 1.0;
    }

    // Binning Helper Functions
    function computeHistograms(particles) {
        // 1. Speed Bins: 0-50, 50-100, 100-150, 150-200, 200+
        const speedBins = [0, 0, 0, 0, 0];
        // 2. Charge Bins: -4, -3, -2, -1, 0, +1, +2, +3, +4
        const chargeBins = Array(9).fill(0);
        // 3. Age Bins in Shakes (1 shake = 10s): 0-1, 1-3, 3-6, 6-10, 10+ shakes[cite: 22]
        const ageBins = [0, 0, 0, 0, 0];

        particles.forEach(p => {
            // Speed
            const speed = Math.hypot(p.vx, p.vy);
            const sIdx = Math.min(4, Math.floor(speed / 50));
            speedBins[sIdx]++;

            // Charge (-4 to +4)
            const cIdx = Math.min(8, Math.max(0, p.chargeVal + 4));
            chargeBins[cIdx]++;

            // Age in Shakes[cite: 22]
            const shakes = p.ageShakes; //[cite: 22]
            let aIdx = 0;
            if (shakes >= 10) aIdx = 4;
            else if (shakes >= 6) aIdx = 3;
            else if (shakes >= 3) aIdx = 2;
            else if (shakes >= 1) aIdx = 1;
            ageBins[aIdx]++;
        });

        return { speedBins, chargeBins, ageBins };
    }

    // Update loop hook in updateHUD()[cite: 22]
    function updateHistogramStrips() {
        const alphaParticles = arena.particles.filter(p => p.sourceId && p.sourceId.includes('alpha'));
        const betaParticles  = arena.particles.filter(p => p.sourceId && p.sourceId.includes('beta'));

        const alphaData = computeHistograms(alphaParticles);
        const betaData  = computeHistograms(betaParticles);

        // Alpha Strip Charts
        renderDistributionHistogram('alpha-speed-canvas', alphaData.speedBins, alphaEngine.intrinsicColor);
        renderDistributionHistogram('alpha-charge-canvas', alphaData.chargeBins, alphaEngine.intrinsicColor);
        renderDistributionHistogram('alpha-age-canvas', alphaData.ageBins, alphaEngine.intrinsicColor);

        // Beta Strip Charts
        renderDistributionHistogram('beta-speed-canvas', betaData.speedBins, betaEngine.intrinsicColor);
        renderDistributionHistogram('beta-charge-canvas', betaData.chargeBins, betaEngine.intrinsicColor);
        renderDistributionHistogram('beta-age-canvas', betaData.ageBins, betaEngine.intrinsicColor);
    }

    function resetMatchTimer() {
        const timeVal = parseInt(document.getElementById('timer-select').value, 10);
        matchTimeRemaining = timeVal;
        timerExpired = false;
        
        const overlay = document.getElementById('arena-timer');
        if (timeVal > 0) {
            overlay.style.display = 'block';
            updateTimerDisplay();
        } else {
            overlay.style.display = 'none';
        }
    }

    function updateTimerDisplay() {
        const overlay = document.getElementById('arena-timer');
        const mins = Math.floor(matchTimeRemaining / 60);
        const secs = Math.floor(matchTimeRemaining % 60);
        overlay.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function executeTimeUpAction() {
        timerExpired = true;
        const action = document.getElementById('action-select').value;
        const timerDisplay = document.getElementById('arena-timer');
        
        timerDisplay.innerText = "TIME EXPIRED";
        timerDisplay.style.color = "#ff3366";
        timerDisplay.style.borderColor = "#ff3366";

        if (action === 'GRAVITY') {
            // Max gravity slider to +20,000,000
            const gravitySlider = document.getElementById('gravity-slider');
            gravitySlider.value = 20000000;
            updateGravity(20000000);
        } else if (action === 'GEOMETRY') {
            // Force arena boundary mode to NONE
            arena.boundaryMode = 'none';
            document.getElementById('boundary-btn').innerText = 'BOUNDARIES: NONE';
        }
    }

    // Triggers the Game Over Scorecard overlay
    function triggerGameOver() {
        isRunning = false;
        const btn = document.getElementById('sim-btn');
        if (btn) {
            btn.innerText = "|>";
            btn.classList.add('pulse-green');
        }

        // Copy live preview canvases to scorecard canvases
        const srcAlphaCvs = document.getElementById('glyph-alpha-canvas');
        const srcBetaCvs  = document.getElementById('glyph-beta-canvas');
        
        const dstAlphaCvs = document.getElementById('scorecard-alpha-preview');
        const dstBetaCvs  = document.getElementById('scorecard-beta-preview');

        dstAlphaCvs.getContext('2d').drawImage(srcAlphaCvs, 0, 0, 64, 64);
        dstBetaCvs.getContext('2d').drawImage(srcBetaCvs, 0, 0, 64, 64);

        // Populate designations, owners, generations & scores
        document.getElementById('scorecard-alpha-name').innerText  = document.getElementById('alpha-name').innerText;
        document.getElementById('scorecard-alpha-owner').innerText = document.getElementById('alpha-owner').innerText;
        document.getElementById('scorecard-alpha-gen').innerText   = document.getElementById('alpha-gen').innerText;
        document.getElementById('scorecard-alpha-score').innerText = scores.alphaScore;

        document.getElementById('scorecard-beta-name').innerText  = document.getElementById('beta-name').innerText;
        document.getElementById('scorecard-beta-owner').innerText = document.getElementById('beta-owner').innerText;
        document.getElementById('scorecard-beta-gen').innerText   = document.getElementById('beta-gen').innerText;
        document.getElementById('scorecard-beta-score').innerText = scores.betaScore;

        // Apply color accents from intrinsic colors
        const cardAlpha = document.getElementById('card-alpha');
        const cardBeta  = document.getElementById('card-beta');
        
        cardAlpha.style.borderColor = alphaEngine.intrinsicColor;
        cardBeta.style.borderColor  = betaEngine.intrinsicColor;

        // Determine Winner: Standard score or lower negative wins
        cardAlpha.classList.remove('winner');
        cardBeta.classList.remove('winner');

        if (scores.alphaScore !== scores.betaScore) {
            // Higher score wins (including less negative, e.g., -5 wins against -20)
            if (scores.alphaScore > scores.betaScore) {
                cardAlpha.classList.add('winner');
            } else {
                cardBeta.classList.add('winner');
            }
        }

        // Float overlay up
        document.getElementById('game-over-overlay').classList.add('active');
    }

    function dismissGameOver() {
        document.getElementById('game-over-overlay').classList.remove('active');
    }

    function updateGlyphColorStyling(source, color) {
        const prefix = source === 'alpha' ? 'alpha' : 'beta';
        
        // Update color text readout
        const colorElem = document.getElementById(`${prefix}-color`);
        if (colorElem) {
            colorElem.style.color = color;
            colorElem.innerText = color.toUpperCase();
        }

        // Update canvas preview container border & glow box-shadow
        const previewContainer = document.querySelector(`#${prefix}-panel .glyph-preview`);
        if (previewContainer) {
            previewContainer.style.borderColor = color;
            previewContainer.style.boxShadow = `0 0 14px ${color}80, inset 0 0 6px ${color}40`;
        }
    }

</script>

</body>
</html>