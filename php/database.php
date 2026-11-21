<?php
// Dedicated CYBERTRACE contact database: name and email only.
declare(strict_types=1);

$databaseFile = __DIR__ . '/cybertrace_php_users.db';

try {
    $database = new PDO('sqlite:' . $databaseFile);
    $database->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $database->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    $database->exec('CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )');
} catch (PDOException $error) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Could not open the PHP user database.']);
    exit;
}
