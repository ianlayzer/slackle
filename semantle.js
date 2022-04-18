/*
    Copyright (c) 2022, David Turner <novalis@novalis.org>

     This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, version 3.

    This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
*/
'use strict';

const now = Date.now();
const today = Math.floor(now / 86400000);
const initialDay = 19021;
function getPuzzleNumber(day) {
    return (day - initialDay) % secretWords.length;
}
function getSecretWord(day) {
    return secretWords[getPuzzleNumber(day)];
}

let model = null;
const puzzleNumber = getPuzzleNumber(today);
let puzzleKey;
let storage;
let caps = 0;
let warnedCaps = 0;
let chrono_forward = 1;


function mag(a) {
    return Math.sqrt(a.reduce(function(sum, val) {
        return sum + val * val;
    }, 0));
}

function dot(f1, f2) {
    return f1.reduce(function(sum, a, idx) {
        return sum + a*f2[idx];
    }, 0);
}

function getCosSim(f1, f2) {
    return dot(f1,f2)/(mag(f1)*mag(f2));
}


function plus(v1, v2) {
    const out = [];
    for (let i = 0; i < v1.length; i++) {
            out.push(v1[i] + v2[i]);
    }
    return out;
}

function minus(v1, v2) {
    const out = [];
    for (let i = 0; i < v1.length; i++) {
        out.push(v1[i] - v2[i]);
    }
    return out;
}


function scale (v, s) {
    const out = [];
    for (let i = 0; i < v.length; i++) {
        out.push(v[i] * s);
    }
    return out;
}

function project_along(v1, v2, t) {
    const v = minus(v2, v1);
    const num = dot(minus(t, v1), v);
    const denom = dot(v,v);
    return num/denom;
}

const words_selected = [];
const cache = {};
let secret = "";
let secretVec = null;
let similarityStory = null;
let customMode = false;

function guessRow(similarity, oldGuess, percentile, guessNumber, guess) {
    let percentileText = "(cold)";
    let progress = "";
    let cls = "";
    if (similarity >= similarityStory.rest * 100) {
        percentileText = '<span class="weirdWord">????<span class="tooltiptext">Unusual word found!  This word is not in the list of &quot;normal&quot; words that we use for the top-1000 list, but it is still similar! (Is it maybe capitalized?)</span></span>';
    }
    if (percentile) {
        if (percentile == 1000) {
            percentileText = "FOUND!";
        } else {
            cls = "close";
            percentileText = `<span class="percentile">${percentile}/1000</span>&nbsp;`;
            progress = ` <span class="progress-container">
<span class="progress-bar" style="width:${percentile/10}%">&nbsp;</span>
</span>`;
        }
    }
    let color;
    if (oldGuess === guess) {
        color = '#c0c';
    } else if (darkMode) {
        color = '#fafafa';
    } else {
        color = '#000';
    }
    const similarityLevel = similarity * 2.55;
    let similarityColor;
    if (darkMode) {
        similarityColor = `255,${255-similarityLevel},${255-similarityLevel}`;
    } else {
        similarityColor = `${similarityLevel},0,0`;
    }
    return `<tr><td>${guessNumber}</td><td style="color:${color}" onclick="select('${oldGuess}', secretVec);">${oldGuess}</td><td style="color: rgb(${similarityColor})">${similarity.toFixed(2)}</td><td class="${cls}">${percentileText}${progress}
</td></tr>`;

}

function getQueryParameter(name) {
    const url = window.location.href
    const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
    const results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2]);
}

let Semantle = (function() {

    async function getModel(word) {
        if (cache.hasOwnProperty(word)) {
            return cache[word];
        }
        const url = "/model2/" + secret + "/" + word.replace(/\ /gi, "_");
        const response = await fetch(url);
        try {
            return await response.json();
        } catch (e) {
            return null;
        }
    }

    async function getNearby(word) {
        const url = "/nearby/" + word ;
        const response = await fetch(url);
        try {
            return await response.json();
        } catch (e) {
            return null;
        }
    }

    async function init() {
        secret = getSecretWord(today).toLowerCase();
        storage = window.localStorage;
        puzzleKey = puzzleNumber;



        if (secretVec === null) {
            secretVec = (await getModel(secret)).vec;
        }
        $('#guess').focus();
        $('#error').textContent = "";
        let guess = $('#guess').value.trim().replace("!", "").replace("*", "");
        if (!guess) {
            return false;
        }
        if ($("#lower").checked) {
            guess = guess.toLowerCase();
        }

        if (typeof unbritish !== 'undefined' && unbritish.hasOwnProperty(guess)) {
            guess = unbritish[guess];
        }

        if (guess[0].toLowerCase() != guess[0]) {
            caps += 1;
        }
        if (caps >= 2 && (caps / guesses.length) > 0.4 && !warnedCaps) {
            warnedCaps = true;
            $("#lower").checked = confirm("You're entering a lot of words with initial capital letters.  This is probably not what you want to do, and it's probably caused by your phone keyboard ignoring the autocapitalize setting.  \"Nice\" is a city. \"nice\" is an adjective.  Do you want me to downcase your guesses for you?");
            window.localStorage.setItem("lower", "true");
        }

        $('#guess').value = "";

        const guessData = await getModel(guess);
        if (!guessData) {
            $('#error').textContent = `I don't know the word ${guess}.`;
            return false;
        }

        let percentile = guessData.percentile;

        const guessVec = guessData.vec;

        cache[guess] = guessData;

        let similarity = getCosSim(guessVec, secretVec) * 100.0;
        if (!guessed.has(guess)) {
            if (!gameOver) {
                guessCount += 1;
            }
            guessed.add(guess);

            const newEntry = [similarity, guess, percentile, guessCount];
            guesses.push(newEntry);

            if (handleStats) {
                const stats = getStats();
                if (!gameOver) {
                    stats['totalGuesses'] += 1;
                }
                storage.setItem('stats', JSON.stringify(stats));
            }
        }
        guesses.sort(function(a, b){return b[0]-a[0]});

        if (!gameOver) {
            saveGame(-1, -1);
        }

        chrono_forward = 1;

        latestGuess = guess;
        updateGuesses();

        if (guess.toLowerCase() === secret && !gameOver) {
            endGame(true, true);
        }
        return false;
    }


})();
