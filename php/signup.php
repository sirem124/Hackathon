<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: http://localhost:3000');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require __DIR__ . '/database.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Use POST to create a record.']);
    exit;
}

$input = [];
if (str_starts_with($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) {
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
}

$name = trim((string)($input['name'] ?? $_POST['name'] ?? ''));
$email = strtolower(trim((string)($input['email'] ?? $_POST['email'] ?? '')));

if (mb_strlen($name, 'UTF-8') < 2) {
    http_response_code(400);
    echo json_encode(['error' => 'Please enter a valid name.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Please enter a valid email address.']);
    exit;
}

try {
    $statement = $database->prepare('INSERT INTO users (name, email) VALUES (:name, :email)');
    $statement->execute(['name' => $name, 'email' => $email]);

    http_response_code(201);
    echo json_encode([
        'created' => true,
        'id' => $database->lastInsertId(),
        'name' => $name,
        'email' => $email
    ]);
} catch (PDOException $error) {
    if ((int)$error->getCode() === 23000) {
        http_response_code(409);
        echo json_encode(['error' => 'This email is already registered.']);
        exit;
    }

    http_response_code(500);
    echo json_encode(['error' => 'Could not save the user.']);
}
