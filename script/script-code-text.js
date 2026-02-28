const el = document.querySelector(".typing");

const baseText = "Étudiant en ";
const firstWord = "informatique";
const secondWord = "développement informatique.";

let index = 0;
let step = 0;
let deleting = false;

function generateRandomNumberBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function type() {
    if (step === 0) {
        if (index < baseText.length + firstWord.length) {
            el.textContent = (baseText + firstWord).substring(0, index + 1);
            index++;
            setTimeout(type, generateRandomNumberBetween(50, 200));
        } else {
            step = 1;
            deleting = true;
            setTimeout(type, 1000);
        }
    } else if (step === 1) {
        if (index > baseText.length) {
            el.textContent = (baseText + firstWord).substring(0, index - 1);
            index--;
            setTimeout(type, generateRandomNumberBetween(50, 50));
        } else {
            step = 2;
            deleting = false;
            setTimeout(type, 500);
        }
    } else if (step === 2) {
        if (index < baseText.length + secondWord.length) {
            el.textContent = (baseText + secondWord).substring(0, index + 1);
            index++;
            setTimeout(type, generateRandomNumberBetween(50, 200));
        }
    }
}

function startCodeTextAnimation() {
    type();
}