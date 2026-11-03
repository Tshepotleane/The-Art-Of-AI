
/* ============================================================
   THE ART OF AI
   OPTIMIZED MAIN JAVASCRIPT
============================================================ */

let selectedType = "text";
let isGenerating = false;

/* DOM ELEMENTS */

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


/* ============================================================
   THEME MANAGEMENT
============================================================ */

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

const savedTheme = localStorage.getItem("theme") || "dark";

applyTheme(savedTheme);

if (themeToggle) {
    themeToggle.addEventListener("click", () => {
        const nextTheme =
            document.body.classList.contains("dark-theme")
                ? "light"
                : "dark";

        applyTheme(nextTheme);
    });
}


/* ============================================================
   CONTENT TYPE SELECTION
============================================================ */

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


/* ============================================================
   PROMPT PLACEHOLDER
============================================================ */

function updatePlaceholder() {
    if (!promptInput) return;

    const placeholders = {
        text: "Describe the text you want the AI to create...",
        code: "Describe the code you want the AI to create...",
        image: "Describe the image you want the AI to create..."
    };

    promptInput.placeholder =
        placeholders[selectedType] || placeholders.text;
}


/* ============================================================
   PROMPT LIBRARY
============================================================ */

promptCards.forEach(card => {
    card.addEventListener("click", () => {
        promptInput.value = card.dataset.prompt;

        promptInput.focus();
    });
});


/* ============================================================
   GENERATE CONTENT
============================================================ */

if (generateButton) {
    generateButton.addEventListener("click", generateContent);
}


async function generateContent() {

    // Prevent multiple simultaneous requests
    if (isGenerating) return;

    const prompt = promptInput.value.trim();

    if (!prompt) {
        alert("Please enter a prompt first.");
        return;
    }

    isGenerating = true;

    // Hide previous result
    resultSection.classList.add("hidden");

    resultBox.innerHTML = "";

    // Show loading animation
    loading.classList.remove("hidden");

    // Update button
    generateButton.disabled = true;

    generateButton.innerHTML =
        "<span>✦</span> Generating...";

    // Different timeout for text/code and image generation
    const timeoutDuration =
        selectedType === "image"
            ? 90000
            : 120000;

    const controller = new AbortController();

    const timeoutId = setTimeout(() => {
        controller.abort();
    }, timeoutDuration);

    try {

        // Send request to Flask
        const response = await fetch("/generate", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                prompt: prompt,
                content_type: selectedType
            }),

            signal: controller.signal
        });

        // Parse JSON response
        const data = await response.json();

        // Handle errors
        if (!response.ok || !data.success) {
            throw new Error(
                data.error ||
                `Request failed with HTTP ${response.status}`
            );
        }

        // Display successful result
        displayResult(data);

    } catch (error) {

        console.error("Generation error:", error);

        resultSection.classList.remove("hidden");

        let errorMessage;

        if (error.name === "AbortError") {
            errorMessage =
                selectedType === "image"
                    ? "Image generation is taking too long. Please try again later."
                    : "Generation took too long. Please try a shorter prompt.";
        } else if (error instanceof TypeError) {
            errorMessage =
                "Unable to connect to the server. Please try again.";
        } else {
            errorMessage = error.message ||
                "Something went wrong. Please try again.";
        }

        resultBox.textContent = "Error: " + errorMessage;

    } finally {

        clearTimeout(timeoutId);

        // Always hide loading
        loading.classList.add("hidden");

        // Restore button
        generateButton.disabled = false;

        generateButton.innerHTML =
            "<span>✦</span> Generate";

        isGenerating = false;
    }
}


/* ============================================================
   DISPLAY GENERATED CONTENT
============================================================ */

function displayResult(data) {

    resultSection.classList.remove("hidden");

    resultBox.innerHTML = "";

    // IMAGE RESULT
    if (data.type === "image" && data.result) {

        const image = document.createElement("img");

        image.src = data.result;

        image.alt = "AI generated image";

        image.className = "result-image";

        image.loading = "lazy";

        resultBox.appendChild(image);

        return;
    }

    // BASE64 IMAGE RESULT
    if (data.type === "image_base64" && data.result) {

        const image = document.createElement("img");

        image.src =
            "data:image/png;base64," + data.result;

        image.alt = "AI generated image";

        image.className = "result-image";

        resultBox.appendChild(image);

        return;
    }

    // TEXT AND CODE RESULT
    const text = document.createElement("div");

    text.textContent = data.result;

    resultBox.appendChild(text);
}


/* ============================================================
   COPY GENERATED CONTENT
============================================================ */

if (copyButton) {

    copyButton.addEventListener("click", async () => {

        const text = resultBox.innerText;

        if (!text) return;

        try {

            await navigator.clipboard.writeText(text);

            copyButton.textContent = "Copied!";

            setTimeout(() => {
                copyButton.textContent = "Copy";
            }, 1500);

        } catch (error) {

            console.error("Clipboard error:", error);

            alert("Unable to copy the content.");
        }
    });
}


/* ============================================================
   CLEAR CONTENT
============================================================ */

if (clearButton) {

    clearButton.addEventListener("click", () => {

        if (isGenerating) return;

        promptInput.value = "";

        resultBox.innerHTML = "";

        resultSection.classList.add("hidden");

        selectedType = "text";

        typeButtons.forEach(button => {
            button.classList.remove("active");
        });

        const textButton =
            document.querySelector('[data-type="text"]');

        if (textButton) {
            textButton.classList.add("active");
        }

        updatePlaceholder();

        promptInput.focus();
    });
}


/* ============================================================
   KEYBOARD SHORTCUT
============================================================ */

if (promptInput) {

    promptInput.addEventListener("keydown", event => {

        if (
            event.ctrlKey &&
            event.key === "Enter"
        ) {
            generateContent();
        }
    });
}


/* ============================================================
   INITIALIZE APPLICATION
============================================================ */

updatePlaceholder();

console.log("The Art Of AI initialized successfully.");
