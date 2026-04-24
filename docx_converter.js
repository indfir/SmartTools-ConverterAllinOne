const { spawn } = require('child_process');
const path = require('path');

/**
 * Convert DOCX to PDF using Python script
 * @param {string} inputPath - Path to input DOCX file
 * @param {string} outputPath - Path to output PDF file
 * @returns {Promise<{success: boolean, error?: string}>}
 */
function convertDocxToPdf(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        const pythonScript = path.join(__dirname, 'docx_to_pdf.py');
        
        const python = spawn('python', [pythonScript, inputPath, outputPath]);
        
        let stdout = '';
        let stderr = '';
        
        python.stdout.on('data', (data) => {
            stdout += data.toString();
        });
        
        python.stderr.on('data', (data) => {
            stderr += data.toString();
        });
        
        python.on('close', (code) => {
            if (code === 0) {
                resolve({ success: true, message: stdout.trim() });
            } else {
                reject(new Error(stderr.trim() || `Python process exited with code ${code}`));
            }
        });
        
        python.on('error', (err) => {
            reject(new Error(`Failed to start Python: ${err.message}`));
        });
    });
}

module.exports = { convertDocxToPdf };
