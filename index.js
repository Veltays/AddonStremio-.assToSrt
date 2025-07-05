const express = require('express');
const axios = require('axios');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = 7000;
const TEMP_DIR = path.join(__dirname, 'convert');

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

app.get('/convert', async (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).send('❌ URL manquante');

    const assFile = path.join(TEMP_DIR, `temp-${Date.now()}.ass`);
    const srtFile = assFile.replace('.ass', '.srt');

    try {
        const response = await axios.get(url, { responseType: 'stream' });
        const writer = fs.createWriteStream(assFile);
        response.data.pipe(writer);

        writer.on('finish', () => {
            exec(`ffmpeg -i "${assFile}" "${srtFile}" -y`, (error, stdout, stderr) => {
                if (error) {
                    console.error('Erreur ffmpeg:', error);
                    return res.status(500).send('Erreur de conversion');
                }

                res.download(srtFile, 'converted.srt', (err) => {
                    fs.unlinkSync(assFile);
                    fs.unlinkSync(srtFile);
                    if (err) console.error('Erreur envoi fichier:', err);
                });
            });
        });

        writer.on('error', err => {
            console.error('Erreur écriture fichier:', err);
            res.status(500).send('Erreur de téléchargement');
        });

    } catch (err) {
        console.error('Erreur téléchargement URL:', err);
        res.status(500).send('Impossible de télécharger le fichier .ass');
    }
});

app.listen(PORT, () => {
    console.log(`✅ Serveur lancé sur http://localhost:${PORT}`);
});