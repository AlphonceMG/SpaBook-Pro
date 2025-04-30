import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '..', 'logs');
console.log('Initializing logger...');
console.log('Logs directory:', logsDir);

// Queue for log messages
const logQueue = [];
let isProcessingQueue = false;

// Initialize logging system
async function initializeLogger() {
    try {
        if (!fs.existsSync(logsDir)) {
            await fs.promises.mkdir(logsDir, { recursive: true });
            console.log('Created logs directory');
        } else {
            console.log('Logs directory already exists');
        }
    } catch (error) {
        console.error('Error creating logs directory:', error);
    }
}

// Create separate log files for different processes
const bookingLogPath = path.join(logsDir, 'booking-process.log');
const errorLogPath = path.join(logsDir, 'error.log');

// Ensure log files exist
try {
    if (!fs.existsSync(bookingLogPath)) {
        fs.writeFileSync(bookingLogPath, ''); // Create empty file
        console.log('Created booking-process.log');
    }
    if (!fs.existsSync(errorLogPath)) {
        fs.writeFileSync(errorLogPath, ''); // Create empty file
        console.log('Created error.log');
    }
} catch (error) {
    console.error('Error creating log files:', error);
}

function formatLogMessage(type, message, data = null) {
    const timestamp = new Date().toISOString();
    const logData = data ? `\nData: ${JSON.stringify(data, null, 2)}` : '';
    return `[${timestamp}] [${type}] ${message}${logData}\n`;
}

async function processLogQueue() {
    if (isProcessingQueue || logQueue.length === 0) return;
    
    isProcessingQueue = true;
    
    try {
        while (logQueue.length > 0) {
            const { filePath, message } = logQueue.shift();
            await fs.promises.appendFile(filePath, message);
            
            // Optional: Console output (can be disabled in production)
            if (process.env.NODE_ENV !== 'production') {
                console.log(message);
            }
        }
    } catch (err) {
        console.error('Error processing log queue:', err);
    } finally {
        isProcessingQueue = false;
        
        // Check if new items were added while processing
        if (logQueue.length > 0) {
            setImmediate(processLogQueue);
        }
    }
}

function queueLog(filePath, message) {
    logQueue.push({ filePath, message });
    setImmediate(processLogQueue);
}

export const logger = {
    bookingProcess: (message, data = null) => {
        const logMessage = formatLogMessage('BOOKING', message, data);
        queueLog(bookingLogPath, logMessage);
    },
    error: (message, error = null) => {
        const logMessage = formatLogMessage('ERROR', message, error);
        queueLog(errorLogPath, logMessage);
        // Always show errors in console
        console.error(logMessage);
    }
};

// Initialize the logger
initializeLogger(); 