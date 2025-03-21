document.addEventListener('DOMContentLoaded', function() {
    const code = `async function loadCSV(file) {
    let text = await file.text();
    return text.split("\\n").map(name => name.trim()).filter(name => name);
}

function findRowByName(name) {
    for (let row of document.querySelectorAll(".StudentTableItem__Container-sc-xspry6-0")) {
        let studentName = row.querySelector(".student-name-text")?.textContent.trim();
        if (studentName?.toLowerCase() === name.toLowerCase()) return row;
    }
    return null;
}

async function runRPA(namesList) {
    for (const name of namesList) {
        console.log("🔍 Searching for: " + name);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for UI update

        let row = findRowByName(name);
        let checkbox = row?.querySelector(".checkbox");

        if (checkbox) {
            console.log("✅ Selecting: " + name);
            checkbox.click();
        } else {
            console.warn("⚠️ Not found: " + name);
        }

        await new Promise(resolve => setTimeout(resolve, 1000)); // Pause before next name
    }

    console.log("🎉 RPA task completed!");
}

function promptCSVUpload() {
    let input = Object.assign(document.createElement("input"), { type: "file", accept: ".csv" });
    input.addEventListener("change", async e => {
        let namesList = await loadCSV(e.target.files[0]);
        console.log("📂 CSV Loaded. Starting RPA...");
        runRPA(namesList);
    });
    input.click();
}

promptCSVUpload();`;

    document.getElementById('automation-code').textContent = code;
});

function copyCode() {
    const codeElement = document.getElementById('automation-code');
    const textArea = document.createElement('textarea');
    textArea.value = codeElement.textContent;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);

    const button = document.querySelector('.copy-button');
    const originalText = button.textContent;
    button.textContent = 'Copied!';
    setTimeout(() => {
        button.textContent = originalText;
    }, 2000);
}