#!/usr/bin/env node

import inquirer from 'inquirer';
import chalk from 'chalk'
import axios from 'axios';
import { createSpinner } from 'nanospinner'
import fs from 'fs';


console.clear()
console.log("\n")
console.log(chalk.blue("Bienvenue sur Pathbuilder2 !"))
console.log("\n")

let spinner;

spinner = createSpinner('Chargement des classes...').start()
let classes = await axios.get('https://pf2-database.herokuapp.com/getDataSets?cat=classes')
let classesChoice = []
for (const key of Object.keys(classes.data)) {
    classesChoice.push({ name: classes.data[key].name, value: { key, classInfo: classes.data[key] } })
}
spinner.success({ text: "Classes chargées avec succès." })

spinner = createSpinner('Chargement des héritages...').start()
let ancestries = await axios.get('https://pf2-database.herokuapp.com/getDataSets?cat=ancestries')
let ancestriesChoice = []
for (const ancestry of Object.values(ancestries.data)) {
    ancestriesChoice.push({ name: ancestry.name, value: ancestry })
}
spinner.success({ text: "Héritages chargés avec succès." })

spinner = createSpinner('Chargement des dons...').start()
let feats = await axios.get('https://pf2-database.herokuapp.com/getDataSets?cat=feats')
spinner.success({ text: "Dons chargés avec succès." })

let basicInfos = await inquirer.prompt([
    {
        name: "characterName",
        type: "input",
        message: "Quel sera le nom du personnage ?",
        validate: function (input) {
            // console.log(input)
            if (input.length > 2) {
                return true
            } else {
                return "Le nom doit composer au moins 3 caracères."
            }
            // return true
        }
    },
    {
        name: "characterLevel",
        type: "input",
        message: "Quel est son niveau ?",
        validate: function (input) {
            // console.log(input)
            if (!input.length < 0 || isNaN(input)) return "Le niveau doit être un chiffre."
            if (input < 1 || input > 20) return "Le niveau doit être compris entre 1 et 20"
            return true
        }
    },
    {
        name: "characterClass", type: "list", message: "Quelle classe de personnage avez vous choisi ?", choices: classesChoice, default: 13,
    },
    {
        name: "characterAncestry", type: "list", message: "Quelle sera son héritage ?", choices: ancestriesChoice, default: 6
    },
])

let flag = true;

let selectedFeats

while (flag) {
    selectedFeats = await askFeats()
    console.log(chalk.red("Est ce que cela vous convient ?"))
    let message = ""
    for (const feat of selectedFeats) {
        message += " - " + feat.name + " (" + feat.data.level.value + ")" + "\n"
    }
    flag = await inquirer.prompt([{
        name: "confirm", message: message.slice(0, -1) + "\n", type: "confirm", prefix: ""
    }])
    flag = !flag.confirm
}

let character = {
    name: basicInfos.characterName,
    level: basicInfos.characterLevel,
    classe: basicInfos.characterClass,
    ancestry: basicInfos.characterAncestry,
    classFeats: selectedFeats
}

fs.writeFileSync("./player.json", JSON.stringify(character));

console.log(chalk.blue("Fichier player.json généré avec succès."))


//--------------------------------------------
//--------------------------------------------
//--------------------------------------------
// Sélection des dons
async function askFeats() {
    let featsArray = Object.values(feats.data)

    let classFeats = featsArray.filter(feat => (feat.data.featType.value == "class" && feat.data.traits.value.includes(basicInfos.characterClass.key)))

    let level = basicInfos.characterLevel
    let selectedFeats = []

    for (const featLevel of basicInfos.characterClass.classInfo.data.classFeatLevels.value) {
        // console.log(featLevel)
        if (featLevel <= level) {

            let feats = classFeats.filter(feat => feat.data.level.value <= featLevel).map(item => ({ name: item.name, value: item }));

            selectedFeats.push(await inquirer.prompt([
                {
                    name: "feat", type: "list", message: "Don de niveau " + featLevel, choices: feats
                }
            ]))
        }
    }
    return selectedFeats.map(item => item.feat)
}



// console.log(selectedFeats)


// console.log(basicInfos)
