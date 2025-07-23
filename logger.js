const fs = require('fs');
const path = require('path');
const os = require('os');

// Define o diretório dos dados do usuário
const userDataDir = path.join(os.homedir(), 'EconomizeData');

// Certifica-se de que o diretório exista
if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir);
}

// Define o caminho para o arquivo de log
const logFilePath = path.join(userDataDir, 'log.txt');

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logFilePath, logMessage);
}

module.exports = {
    log
};
