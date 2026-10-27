
/* ============================================================
   THE ART OF AI
   MAIN JAVASCRIPT
============================================================ */


/* ============================================================
   GLOBAL VARIABLES
============================================================ */

let selectedType = "text";


/* ============================================================
   DOM ELEMENTS
============================================================ */

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

    document.body.classList.toggle(
        "dark-theme",
        isDark
    );

    document.body.classList.toggle(
        "light-theme",
        !isDark
    );


    // Update theme label

    if (themeLabel) {

        themeLabel.textContent = isDark
            ? "Light"
            : "Dark";

    }


    // Update accessibility label

    if (themeToggle) {

        themeToggle.setAttribute(
            "aria-label",
            isDark
                ? "Switch to light mode"
                : "Switch to dark mode"
        );

    }


    // Save selected theme

    localStorage.setItem(
        "theme",
        theme
    );

}


// Load saved theme

const savedTheme = localStorage.getItem("theme") || "dark";

applyTheme(savedTheme);


// Theme toggle button

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

        // Remove active state from all buttons

        typeButtons.forEach(item => {

            item.classList.remove("active");

        });


        // Activate selected button

        button.classList.add("active");


        // Update selected content type

        selectedType = button.dataset.type;


        // Update prompt placeholder

        updatePlaceholder();

    });

});


/* ============================================================
   PROMPT PLACEHOLDER
============================================================ */

function updatePlaceholder() {

    if (!promptInput) {
        return;
    }


    if (selectedType === "text") {

        promptInput.placeholder =
            "Describe the text you want the AI to create...";

    }

    else if (selectedType === "code") {

        promptInput.placeholder =
            "Describe the code you want the AI to create...";

    }

    else if (selectedType === "image") {

        promptInput.placeholder =
            "Describe the image you want the AI to create...";

    }

}


/* ============================================================
   PROMPT LIBRARY
============================================================ */

promptCards.forEach(card => {

    card.addEventListener("click", () => {

        // Get prompt from selected card

        promptInput.value = card.dataset.prompt;


        // Focus prompt input

        promptInput.focus();

    });

});


/* ============================================================
   GENERATE CONTENT
============================================================ */

if (generateButton) {

    generateButton.addEventListener(
        "click",
        generateContent
    );

}


async function generateContent() {

    // --------------------------------------------------------
    // GET PROMPT
    // --------------------------------------------------------

    const prompt = promptInput.value.trim();


    // --------------------------------------------------------
    // VALIDATE PROMPT
    // --------------------------------------------------------

    if (!prompt) {

        alert("Please enter a prompt first.");

        return;

    }


    // --------------------------------------------------------
    // SHOW LOADING STATE
    // --------------------------------------------------------

    loading.classList.remove("hidden");

    resultSection.classList.add("hidden");


    // Disable generate button

    generateButton.disabled = true;

    generateButton.textContent = "Generating...";


    // --------------------------------------------------------
    // SEND REQUEST TO FLASK BACKEND
    // --------------------------------------------------------

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


        // ----------------------------------------------------
        // READ RESPONSE AS TEXT
        // ----------------------------------------------------

        const responseText = await response.text();


        // ----------------------------------------------------
        // PARSE JSON SAFELY
        // ----------------------------------------------------

        let data;

        try {

            data = JSON.parse(responseText);

        }

        catch (parseError) {

            console.error(
                "Server returned a non-JSON response:"
            );

            console.error(responseText);


            throw new Error(

                `The server returned an unexpected response ` +
                `(HTTP ${response.status}). ` +
                `Please check the Render logs.`

            );

        }


        // ----------------------------------------------------
        // HANDLE HTTP OR API ERRORS
        // ----------------------------------------------------

        if (!response.ok || !data.success) {

            throw new Error(

                data.error ||
                `Request failed with HTTP ${response.status}`

            );

        }


        // ----------------------------------------------------
        // DISPLAY SUCCESSFUL RESULT
        // ----------------------------------------------------

        displayResult(data);


    }

    catch (error) {

        // ----------------------------------------------------
        // DISPLAY ERROR
        // ----------------------------------------------------

        console.error(
            "Content generation error:",
            error
        );


        resultSection.classList.remove("hidden");


        resultBox.textContent =
            "Error: " + error.message;

    }

    finally {

        // ----------------------------------------------------
        // HIDE LOADING STATE
        // ----------------------------------------------------

        loading.classList.add("hidden");


        // ----------------------------------------------------
        // RESTORE GENERATE BUTTON
        // ----------------------------------------------------

        generateButton.disabled = false;

        generateButton.innerHTML =
            "<span>✦</span> Generate";

    }

}


/* ============================================================
   DISPLAY GENERATED CONTENT
============================================================ */

function displayResult(data) {

    // Show result section

    resultSection.classList.remove("hidden");


    // Clear previous result

    resultBox.innerHTML = "";


    // --------------------------------------------------------
    // IMAGE RESULT
    // --------------------------------------------------------

    if (
        data.type === "image" &&
        data.result
    ) {

        const image = document.createElement("img");


        image.src = data.result;

        image.alt = "AI generated image";

        image.className = "result-image";


        // Append generated image

        resultBox.appendChild(image);


        return;

    }


    // --------------------------------------------------------
    // BASE64 IMAGE RESULT
    // --------------------------------------------------------

    if (
        data.type === "image_base64" &&
        data.result
    ) {

        const image = document.createElement("img");


        image.src =
            "data:image/png;base64," + data.result;

        image.alt = "AI generated image";

        image.className = "result-image";


        // Append generated image

        resultBox.appendChild(image);


        return;

    }


    // --------------------------------------------------------
    // TEXT AND CODE RESULT
    // --------------------------------------------------------

    const text = document.createElement("div");


    text.textContent = data.result;


    // Append generated content

    resultBox.appendChild(text);

}


/* ============================================================
   COPY GENERATED CONTENT
============================================================ */

if (copyButton) {

    copyButton.addEventListener("click", async () => {

        const text = resultBox.innerText;


        // Check result

        if (!text) {

            return;

        }


        try {

            // Copy to clipboard

            await navigator.clipboard.writeText(text);


            // Update button

            copyButton.textContent = "Copied!";


            // Restore button label

            setTimeout(() => {

                copyButton.textContent = "Copy";

            }, 1500);

        }

        catch (error) {

            console.error(
                "Clipboard error:",
                error
            );


            alert(
                "Unable to copy the content."
            );

        }

    });

}


/* ============================================================
   CLEAR CONTENT
============================================================ */

if (clearButton) {

    clearButton.addEventListener("click", () => {

        // Clear prompt

        promptInput.value = "";


        // Clear generated result

        resultBox.innerHTML = "";


        // Hide result section

        resultSection.classList.add("hidden");


        // Reset selected type

        selectedType = "text";


        // Reset content type buttons

        typeButtons.forEach(button => {

            button.classList.remove("active");

        });


        // Activate text button

        const textButton =
            document.querySelector('[data-type="text"]');


        if (textButton) {

            textButton.classList.add("active");

        }


        // Reset placeholder

        updatePlaceholder();


        // Focus prompt

        promptInput.focus();

    });

}


/* ============================================================
   KEYBOARD SHORTCUT
============================================================ */

// Ctrl + Enter generates content

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

// Initialize prompt placeholder

updatePlaceholder();

console.log("The Art Of AI initialized successfully.");
