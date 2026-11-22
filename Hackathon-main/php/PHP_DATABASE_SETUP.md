CYBERTRACE PHP User Database

This separate SQLite database stores only:

Full name
Email address
Account creation timestamp

It deliberately does not store passwords.

Files
database.php creates cybertrace_php_users.db.
signup.php accepts POST fields named name and email.
users.php displays the saved records.
Run on Windows
Install PHP and enable the pdo_sqlite extension.
Open a terminal in this project.
Set an admin password for the records page, then run:
powershell
$env:CYBERTRACE_PHP_ADMIN_PASSWORD = "choose-a-long-password"
php -S localhost:8080
Open:
Viewer: http://localhost:8080/users.php (asks for the password above)
Signup endpoint: POST http://localhost:8080/signup.php  