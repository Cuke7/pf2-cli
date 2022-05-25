#!/usr/bin/env node

import inquirer from 'inquirer';
import chalk from 'chalk'
import axios from 'axios';
import { createSpinner } from 'nanospinner'
import figlet from 'figlet';
import gradient from 'gradient-string';
import fs from 'fs';
import pdf from 'html-pdf-node';

// Initialisation
let spinner;

let dir = "./out"
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

let rawdata = fs.readFileSync('dictionary.json');
let dictionary = JSON.parse(rawdata);

// Question flow
console.clear()

await displayWelcomeText("Pathbuilder")
let name = await askName();
let level = await askLevel();
let classe = await askClasses();
let ancestry = await askAncestries();
let feats = await loadFeats();
let classFeats = []
let userValidation = false;
while (!userValidation) {
    classFeats = await askFeats(feats[0], true)
    userValidation = await confirmFeats(classFeats)
}
userValidation = false
let ancestryFeats = []
while (!userValidation) {
    ancestryFeats = await askFeats(feats[1], false)
    userValidation = await confirmFeats(ancestryFeats)
}

// Files generation
let player = {
    name,
    level,
    classe,
    ancestry,
    classFeats,
    ancestryFeats
}
fs.writeFileSync("./out/player.json", JSON.stringify(player));
console.log(blue("Fichier ") + red("./out/player.json ") + blue("généré avec succès"))
// let data = fs.readFileSync('./out/player.json');
// let player = JSON.parse(data);
spinner = createSpinner(grey('Génération du PDF...')).start()
await generatePDF(player)
spinner.success()
console.log(blue("Fichier ") + red("./out/player.pdf ") + blue("généré avec succès."))



//----------------------------------
//----------------------------------
//----------------------------------
function translate(text) {
    let translation = dictionary.find(item => item.nameEN.toLowerCase() === text.toLowerCase())
    if (!translation) return text
    return translation.nameFR
}

async function generatePDF(player) {
    let options = {
        format: 'A4', margin: {
            top: "15mm",
            bottom: "15mm",
            left: "15mm",
            right: "15mm"
        }
    };
    let html = "<body>"
    html += '<div style="column-count: 2;margin-left: auto; margin-right: auto;">'

    for (const feat of player.classFeats) {
        let translation = await axios.get("https://pf2-database.herokuapp.com/wiki?id=" + feat._id)
        html += addBlock(translation.data.nameFR, translation.data.descriptionFR)
    }

    for (const feat of player.ancestryFeats) {
        let translation = await axios.get("https://pf2-database.herokuapp.com/wiki?id=" + feat._id)
        html += addBlock(translation.data.nameFR, translation.data.descriptionFR)
    }

    html += "</div>"
    html += "</body>"

    html += addStyles()

    // fs.writeFileSync("./test.html", html);

    let file = { content: html };
    return new Promise(function (resolve, reject) {
        pdf.generatePdf(file, options).then(pdfBuffer => {
            // console.log("PDF Buffer:-", pdfBuffer);
            fs.writeFileSync('./out/player.pdf', pdfBuffer)
            resolve()
        });
    })


    function addBlock(title, text) {
        let content = '<div style="padding: 10px 20px 0 20px; display: inline-block; font-family: Georgia, "Times New Roman", serif; font-size: 1.2rem; line-height: 1.5; text-align: left; break-inside: avoid-column; break-inside: avoid;">'
        content += "<h2>" + title + "</h2>"
        content += text
        content += "</div>"
        return content
    }

    function addStyles() {
        return `
        <style>
            h2 {
                color: #6D0000;
            }
        </style>
        `
    }
}


function displayWelcomeText(text) {
    return new Promise(function (resolve, reject) {
        figlet(text, (err, data) => {
            if (err) reject()
            console.log(gradient.fruit.multiline(data))
            resolve()
        })
    })
}

async function askName() {
    let answer = await inquirer.prompt({
        name: "name",
        type: "input",
        message: "Quel est le nom du personnage ?",
        validate: function (input) {
            if (input.length > 2) {
                return true
            } else {
                return "Le nom doit composer au moins 3 caracères."
            }
        }
    })
    return answer.name
}

async function askLevel() {
    let answer = await inquirer.prompt({
        name: "level",
        type: "input",
        message: "Quel est son niveau ?",
        validate: function (input) {
            if (!input.length < 0 || isNaN(input)) return "Le niveau doit être un chiffre."
            if (input < 1 || input > 20) return "Le niveau doit être compris entre 1 et 20"
            return true
        }
    })
    return answer.level
}

async function askClasses() {
    spinner = createSpinner(grey('Chargement des classes...')).start()
    let classesList = await axios.get('https://pf2-database.herokuapp.com/getDataSets?cat=classes')
    let classesChoice = []
    for (const key of Object.keys(classesList.data)) {
        let classe = classesList.data[key]
        let name = translate(classe.name);
        classe.key = key;
        let value = classe
        classesChoice.push({ name, value })
    }
    spinner.success({ text: grey("Classes chargées avec succès.") })
    let answer = await inquirer.prompt({
        name: "classe",
        type: "list",
        message: "Quelle classe de personnage avez vous choisi ?",
        choices: classesChoice, default: 13,
    })
    return answer.classe
}

async function askAncestries() {
    spinner = createSpinner(grey('Chargement des ascendances...')).start()
    let ancestriesList = await axios.get('https://pf2-database.herokuapp.com/getDataSets?cat=ancestries')
    let ancestriesChoice = []
    for (const key of Object.keys(ancestriesList.data)) {
        let ancestry = ancestriesList.data[key]
        let name = translate(ancestry.name);
        ancestry.key = key;
        let value = ancestry
        ancestriesChoice.push({ name, value })
    }
    spinner.success({ text: grey('Ascendances chargés avec succès.') })
    let answer = await inquirer.prompt({
        name: "ancestry",
        type: "list",
        message: "Quelle est son ascendance ?",
        choices: ancestriesChoice, default: 6,
    })
    return answer.ancestry
}

async function loadFeats() {
    spinner = createSpinner(grey('Chargement des dons...')).start()
    let feats = await axios.get('https://pf2-database.herokuapp.com/getDataSets?cat=feats')
    let featsArray = Object.values(feats.data)
    let classFeats = featsArray.filter(feat => (feat.data.featType.value == "class" && feat.data.traits.value.includes(classe.key)))
    let ancestryFeats = featsArray.filter(feat => feat.data.featType.value == "ancestry" && feat.data.traits.value.includes(ancestry.key))
    spinner.success({ text: grey("Dons chargés avec succès.") })
    return [classFeats, ancestryFeats]
}

async function askFeats(feats, isClass) {
    let selectedFeats = []
    if (isClass) {
        for (const featLevel of classe.data.classFeatLevels.value) {
            if (featLevel <= level) {
                let filteredFeats = feats.filter(feat => feat.data.level.value <= featLevel).map(item => ({ name: translate(item.name), value: item }));

                selectedFeats.push(await inquirer.prompt([
                    {
                        name: "feat", type: "list", message: "Sélection du don de classe de niveau " + chalk.red(featLevel), choices: filteredFeats
                    }
                ]))
            }
        }
        return selectedFeats.map(item => item.feat)
    } else {
        for (const featLevel of classe.data.ancestryFeatLevels.value) {
            if (featLevel <= level) {
                let filteredFeats = feats.filter(feat => feat.data.level.value <= featLevel).map(item => ({ name: translate(item.name), value: item }));

                selectedFeats.push(await inquirer.prompt([
                    {
                        name: "feat", type: "list", message: "Sélection du don d'héritage de niveau " + chalk.red(featLevel), choices: filteredFeats
                    }
                ]))
            }
        }
        return selectedFeats.map(item => item.feat)
    }
}

async function confirmFeats(feats) {
    console.log(blue("Est ce que cela vous convient ?") + red(" y ") + blue("pour valider, " + red("n" + blue(" pour recommencer."))))
    let message = ""
    for (const feat of feats) {
        message += " - " + translate(feat.name) + " (" + feat.data.level.value + ")" + "\n"
    }
    let flag = await inquirer.prompt([{
        name: "confirm", message: message.slice(0, -1) + "\n", type: "confirm", prefix: ""
    }])
    return flag.confirm
}

function grey(text) {
    return chalk.grey(text)
}

function red(text) {
    return chalk.red(text)
}

function blue(text) {
    return chalk.blue(text)
}