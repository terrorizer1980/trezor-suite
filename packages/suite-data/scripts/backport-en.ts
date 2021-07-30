/**
 * This script takes latest en.json and creates new file rawMessages.ts
 * You can then manually copy its content to messages.ts.
 * 
 * Problem ? 
 * - messages.ts is created by developers using "developers English" which might be miles away from proper English
 * - en.json is proper English translation by proper translators
 * - en.json is also used by product team to modify meaning of the texts sometimes
 * - when meaning in en.json is different from messages.ts (source strings) it might cause meaning divergence between translations to other languages
 * 
 * Solution ? 
 * - backport proper English from en.json to messages.ts
 * 
 * TODOs ? 
 * - maybe do it automatically with every download of en.json from crowdin?
 */

const fs = require('fs');
const path = require('path');

const messages = require('../../suite/src/support/messages').default;

const targetPath = path.join(__dirname, '../../suite/src/support/rawMessages.ts');
const sourcePath = path.join(__dirname, '../../suite-data/files/translations/en.json');

const source: { [key: string]: string } = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

Object.entries(source).forEach(([key, value]) => {
    if (!messages[key]) {
        return;
    }
    messages[key].defaultMessage = value;
})


fs.writeFileSync(targetPath, `const messages = ` + JSON.stringify(messages, null, 2).replace(/"([^"]+)":/g, '$1:') + '\n export default messages');