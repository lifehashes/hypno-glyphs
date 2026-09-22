<?php
session_start();
header('Content-Type: application/json');

// Include DB config - this file initializes $pdo directly
require_once __DIR__ . '/../../../priv/db_conf_laniakea.php';

// Verify PDO instance exists
if (!isset($pdo) || !($pdo instanceof PDO)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection unavailable']);
    exit;
}

// Auth Guard
if (!isset($_SESSION['username'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$operator_id = $_SESSION['username'];

$input = json_decode(file_get_contents('php://input'), true);

if (!$input || empty($input['map_name']) || empty($input['user_name']) || empty($input['elements'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields: map_name, user_name, or elements']);
    exit;
}

$mapId    = $input['map_id'] ?? null;
$mapName  = trim($input['map_name']);
$userName = trim($input['user_name']);
$gridSize = $input['grid_size'] ?? '1920x1080';
$payload  = json_encode($input['elements']);

try {
    if ($mapId) {
        // Update existing map layout
        $stmt = $pdo->prepare('
            UPDATE hypnomaps 
            SET map_name = :map_name, user_name = :user_name, grid_size = :grid_size, payload = :payload 
            WHERE id = :id
        ');
        $stmt->execute([
            ':map_name' => $mapName,
            ':user_name'=> $userName,
            ':grid_size'=> $gridSize,
            ':payload'  => $payload,
            ':id'        => $mapId
        ]);
        echo json_encode(['status' => 'success', 'map_id' => $mapId]);
    } else {
        // Save new map layout
        $stmt = $pdo->prepare('
            INSERT INTO hypnomaps (map_name, user_name, grid_size, payload) 
            VALUES (:map_name, :user_name, :grid_size, :payload)
        ');
        $stmt->execute([
            ':map_name' => $mapName,
            ':user_name'=> $userName,
            ':grid_size'=> $gridSize,
            ':payload'  => $payload
        ]);
        echo json_encode(['status' => 'success', 'map_id' => $pdo->lastInsertId()]);
    }
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database query failed']);
    exit;
}