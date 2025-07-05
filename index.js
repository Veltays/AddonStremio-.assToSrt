const express = require('express');          // Serveur HTTP
const axios = require('axios');              // Téléchargement HTTP
const fs = require('fs');                    // Lecture/écriture de fichiers
const { exec } = require('child_process');   // Exécution de ffmpeg
const path = require('path');                // Manipulation de chemins

const app = express();
const PORT = 7000;
const TEMP_DIR = path.join(__dirname, 'convert');



// Crée le dossier 'convert' s'il n'existe pas encore
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}




/**
 * Route principale de conversion d'un fichier .ass en .srt
 * 
 * @route GET /convert
 * @query {string} url - Lien vers le fichier .ass distant à convertir
 * @returns {File} - Fichier .srt converti, nettoyé et téléchargé automatiquement
 */

app.get('/convert', async (req, res) => {     // cela fait
    const url = req.query.url;
    if (!url) return res.status(400).send('❌ URL manquante');

    // crée un fichier temporaire dans Convert qui prendra comme nom la date actuelle .ass
    // il servira pour la conversion
    const assFile = path.join(TEMP_DIR, `temp-${Date.now()}.ass`);
    // converti le dit fichier .ass en un fichier de type .srt
    const srtFile = assFile.replace(/\.ass$/, '.srt'); // option 1 – fix simple

    try {
        // Téléchargement du fichier .ass
        const response = await axios.get(url, { responseType: 'stream' });
        const writer = fs.createWriteStream(assFile);
        response.data.pipe(writer);

        // Lorsque le téléchargement est fini
        writer.on('finish', async () => {
            const ffmpegPath = 'C:\\ffmpeg\\bin\\ffmpeg.exe';

            try {
                // Exécution de la conversion avec ffmpeg
                await new Promise((resolve, reject) => {
                    exec(`"${ffmpegPath}" -i "${assFile}" "${srtFile}" -y`, (error, stdout, stderr) => {
                        if (error) return reject(error);
                        resolve();
                    });
                });
                // Nettoyage du fichier SRT
                let srtContent = fs.readFileSync(srtFile, 'utf8');
                srtContent = srtContent
                    .replace(/<[^>]+>/g, '')
                    .replace(/\{[^}]+\}/g, '')
                    .replace(/\r?\n/g, '\n')
                    .replace(/([^\n])\n(?=\d+\n\d{2}:\d{2})/g, '$1\n\n')
                    .trim();
                fs.writeFileSync(srtFile, srtContent, 'utf8');

                // Envoi du fichier SRT converti
                res.download(srtFile, 'converted.srt', (err) => {
                    if (err) console.error('Erreur envoi fichier:', err);
                    fs.unlinkSync(srtFile);
                });
            // Gestion des erreurs de ffmpeg
            } catch (err) {
                console.error('Erreur ffmpeg:', err);
                res.status(500).send('Erreur de conversion');
            } 
            // Suppression du fichier temporaire pour éviter l'encombrement
            finally {
                if (fs.existsSync(assFile)) fs.unlinkSync(assFile); // ← suppression assurée
            }
        });
        // Gestion des erreurs d'écriture
        writer.on('error', err => {
            console.error('Erreur écriture fichier:', err);
            res.status(500).send('Erreur de téléchargement');
        });

    // Gestion des erreurs de téléchargement
    } catch (err) {
        console.error('Erreur téléchargement URL:', err);
        res.status(500).send('Impossible de télécharger le fichier .ass');
    }
});

// Ouverture du serveur
app.listen(PORT, () => {
    console.log(`✅ Serveur lancé sur http://localhost:${PORT}`);
});