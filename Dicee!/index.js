var randomNumber1;
var randomNumber2;
randomNumber1 = Math.floor(Math.random() * 6 + 1);
randomNumber2 = Math.floor(Math.random() * 6 + 1);

const image1 = document.getElementsByClassName("img1")[0];
const image2 = document.getElementsByClassName("img2")[0];
const h1 = document.querySelector("h1");

image1.setAttribute("src", `images/dice${randomNumber1}.png`);
image2.setAttribute("src", `images/dice${randomNumber2}.png`);

if (randomNumber1 === randomNumber2) {
  h1.innerHTML = "Draw!";
} else if (randomNumber1 > randomNumber2) {
  h1.innerHTML = "Player 1 Wins!";
} else {
  h1.innerHTML = "Player 2 Wins!";
}
