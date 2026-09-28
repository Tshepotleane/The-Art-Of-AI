let selectedType = "text";

const typeButtons = document.querySelectorAll(".type-button");
const promptCards = document.querySelectorAll(".prompt-card");

const promptInput = document.getElementById("prompt");
const generateButton = document.getElementById("generateButton");
const themeToggle = document.getElementById("themeToggle");
const themeLabel = themeToggle?.querySelector(".theme-label");

const loading = document.getElementById("loading");
const resultSection = document.getElementById("resultSection");
const resultBox = document.getElementById("result");

const copyButton = document.getElementById("copyButton");
const clearButton = document.getElementById("clearButton");


function applyTheme(theme) {
    const isDark = theme === "dark";

    document.body.classList.toggle("dark-theme", isDark);
    document.body.classList.toggle("light-theme", !isDark);

    if (themeLabel) {
        themeLabel.textContent = isDark ? "Light" : "Dark";
    }

    if (themeToggle) {
        themeToggle.setAttribute(
            "aria-label",
            isDark ? "Switch to light mode" : "Switch to dark mode"
        );
    }

    localStorage.setItem("theme", theme);
}

const initialTheme = "dark";

applyTheme(initialTheme);

if (themeToggle) {
    themeToggle.addEventListener("click", () => {
        const nextTheme = document.body.classList.contains("dark-theme") ? "light" : "dark";
        applyTheme(nextTheme);
    });
}


// SELECT CONTENT TYPE
typeButtons.forEach(button => {

    button.addEventListener("click", () => {

        typeButtons.forEach(item => {
            item.classList.remove("active");
        });

        button.classList.add("active");

        selectedType = button.dataset.type;

        updatePlaceholder();
    });

});


function updatePlaceholder() {

    if (selectedType === "text") {

        promptInput.placeholder =
            "Describe the text you want the AI to create...";

    } else if (selectedType === "code") {

        promptInput.placeholder =
            "Describe the code you want the AI to create...";

    } else if (selectedType === "image") {

        promptInput.placeholder =
            "Describe the image you want the AI to create...";

    }

}


// PROMPT LIBRARY
promptCards.forEach(card => {

    card.addEventListener("click", () => {

        promptInput.value = card.dataset.prompt;

        promptInput.focus();

    });

});


// CLEAR
clearButton.addEventListener("click", () => {
    promptInput.value = "";
    promptInput.focus();
});


// GENERATE
generateButton.addEventListener("click", generateContent);


async function generateContent() {

    const prompt = promptInput.value.trim();

    if (!prompt) {

        alert("Please enter a prompt first.");

        return;
    }


    loading.classList.remove("hidden");
    resultSection.classList.add("hidden");

    generateButton.disabled = true;
    generateButton.textContent = "Generating...";


    try {

        const response = await fetch("/generate", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                prompt: prompt,
                content_type: selectedType
            })

        });


        const data = await response.json();


        if (!response.ok || !data.success) {

            throw new Error(
                data.error || "Something went wrong."
            );

        }


        displayResult(data);


    } catch (error) {

        resultSection.classList.remove("hidden");

        resultBox.textContent =
            "Error: " + error.message;

    } finally {

        loading.classList.add("hidden");

        generateButton.disabled = false;

        generateButton.innerHTML =
            "<span>✦</span> Generate";

    }

}


// DISPLAY RESULT
function displayResult(data) {

    resultSection.classList.remove("hidden");

    resultBox.innerHTML = "";


    if (data.type === "image" && data.result) {

        const image = document.createElement("img");

        image.src = data.result;

        image.alt = "AI generated image";

        image.className = "result-image";

        resultBox.appendChild(image);

        return;
    }


    if (data.type === "image_base64" && data.result) {

        const image = document.createElement("img");

        image.src =
            "data:image/png;base64," + data.result;

        image.alt = "AI generated image";

        image.className = "result-image";

        resultBox.appendChild(image);

        return;
    }


    const text = document.createElement("div");

    text.textContent = data.result;

    resultBox.appendChild(text);
}


// COPY RESULT
copyButton.addEventListener("click", async () => {

    const text = resultBox.innerText;

    if (!text) {
        return;
    }

    try {

        await navigator.clipboard.writeText(text);

        copyButton.textContent = "Copied!";

        setTimeout(() => {

            copyButton.textContent = "Copy";

        }, 1500);

    } catch (error) {

        alert("Unable to copy the content.");

    }

});


// CLEAR
clearButton.addEventListener("click", () => {

    promptInput.value = "";

    resultBox.innerHTML = "";

    resultSection.classList.add("hidden");

    selectedType = "text";

    typeButtons.forEach(button => {

        button.classList.remove("active");

    });

    document
        .querySelector('[data-type="text"]')
        .classList.add("active");

    updatePlaceholder();

});


// ENTER KEY
promptInput.addEventListener("keydown", event => {

    if (event.ctrlKey && event.key === "Enter") {

        generateContent();

    }

});