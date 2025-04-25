const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const themeToggleBtn = document.querySelector("#theme-toggle-btn");
const suggestions = document.querySelector(".suggestions"); // Suggested Messages এলিমেন্ট

// API Setup
const API_KEY = "AIzaSyAqOt4CDfr0lrkxSDl20HKgYWJ0uHHS7rE";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

let controller, typingInterval;
let chatHistory = []; // চ্যাট হিস্টরি অ্যারে
const userData = { message: "", file: {} };

// Set initial theme from local storage
const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
document.body.classList.toggle("light-theme", isLightTheme);
themeToggleBtn.textContent = isLightTheme ? "dark_mode" : "light_mode";

// Local Storage থেকে চ্যাট হিস্টরি লোড করুন
const loadChatHistory = () => {
const savedChats = localStorage.getItem("chatHistory");
if (savedChats) {
chatHistory = JSON.parse(savedChats);
renderChatHistory();
}
toggleSuggestions(); // Suggested Messages টগল করুন
};

// Local Storage-এ চ্যাট হিস্টরি সংরক্ষণ করুন
const saveChatHistory = () => {
localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
};

// Suggested Messages টগল করুন
const toggleSuggestions = () => {
if (chatHistory.length === 0) {
suggestions.style.display = "flex"; // Suggested Messages দেখান
} else {
suggestions.style.display = "none"; // Suggested Messages লুকান
}
};

// চ্যাট হিস্টরি UI-তে রেন্ডার করুন
const renderChatHistory = () => {
chatsContainer.innerHTML = ""; // আগের চ্যাট ক্লিয়ার করুন
chatHistory.forEach((chat) => {
if (chat.role === "user") {
const userMsgHTML = `
<p class="message-text">${chat.parts[0].text}</p>
${chat.parts[1]?.inline_data ? `<img src="data:${chat.parts[1].inline_data.mime_type};base64,${chat.parts[1].inline_data.data}" class="img-attachment" />` : ""}
`;
const userMsgDiv = createMessageElement(userMsgHTML, "user-message");
chatsContainer.appendChild(userMsgDiv);
} else if (chat.role === "model") {
const botMsgHTML = `<img class="avatar" src="https://brandlogo.org/wp-content/uploads/2024/06/Gemini-Icon.png.webp" /> <p class="message-text">${chat.parts[0].text}</p>`;
const botMsgDiv = createMessageElement(botMsgHTML, "bot-message");
chatsContainer.appendChild(botMsgDiv);
}
});
scrollToBottom();
};

// Function to create message elements
const createMessageElement = (content, ...classes) => {
const div = document.createElement("div");
div.classList.add("message", ...classes);
div.innerHTML = content;
return div;
};

// Scroll to the bottom of the container (only if user is already at the bottom)
const scrollToBottom = () => {
const isScrolledToBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 50; // 50px tolerance
if (isScrolledToBottom) {
container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
}
};

// Simulate typing effect for bot responses
const typingEffect = (text, textElement, botMsgDiv) => {
textElement.textContent = "";
const words = text.split(" ");
let wordIndex = 0;

// Set an interval to type each word
typingInterval = setInterval(() => {
if (wordIndex < words.length) {
textElement.textContent += (wordIndex === 0 ? "" : " ") + words[wordIndex++];
scrollToBottom(); // Scroll to bottom only if user is at the bottom
} else {
clearInterval(typingInterval);
botMsgDiv.classList.remove("loading");
document.body.classList.remove("bot-responding");
}
}, 40); // 40 ms delay
};

// Make the API call and generate the bot's response
const generateResponse = async (botMsgDiv) => {
const textElement = botMsgDiv.querySelector(".message-text");
controller = new AbortController();

// Add user message and file data to the chat history
chatHistory.push({
role: "user",
parts: [{ text: userData.message }, ...(userData.file.data ? [{ inline_data: (({ fileName, isImage, ...rest }) => rest)(userData.file) }] : [])],
});

try {
// Send the chat history to the API to get a response
const response = await fetch(API_URL, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ contents: chatHistory }),
signal: controller.signal,
});

const data = await response.json();
if (!response.ok) throw new Error(data.error.message);

// Process the response text and display with typing effect
const responseText = data.candidates[0].content.parts[0].text.replace(/\*\*([^*]+)\*\*/g, "$1").trim();
typingEffect(responseText, textElement, botMsgDiv);

chatHistory.push({ role: "model", parts: [{ text: responseText }] });
saveChatHistory(); // চ্যাট হিস্টরি সংরক্ষণ করুন
} catch (error) {
textElement.textContent = error.name === "AbortError" ? "Response generation stopped." : error.message;
textElement.style.color = "#d62939";
botMsgDiv.classList.remove("loading");
document.body.classList.remove("bot-responding");
scrollToBottom();
} finally {
userData.file = {};
}
};

// Handle the form submission
const handleFormSubmit = (e) => {
e.preventDefault();
const userMessage = promptInput.value.trim();
if (!userMessage || document.body.classList.contains("bot-responding")) return;

userData.message = userMessage;
promptInput.value = "";
document.body.classList.add("chats-active", "bot-responding");
fileUploadWrapper.classList.remove("file-attached", "img-attached", "active");

// Generate user message HTML with optional file attachment
const userMsgHTML = `
<p class="message-text"></p>
${userData.file.data ? (userData.file.isImage ? `<img src="data:${userData.file.mime_type};base64,${userData.file.data}" class="img-attachment" />` : `<p class="file-attachment"><span class="material-symbols-rounded">description</span>${userData.file.fileName}</p>`) : ""}
`;

const userMsgDiv = createMessageElement(userMsgHTML, "user-message");
userMsgDiv.querySelector(".message-text").textContent = userData.message;
chatsContainer.appendChild(userMsgDiv);
scrollToBottom();

// প্রথম মেসেজ পাঠানোর সাথে সাথেই Suggested Messages লুকান
chatHistory.push({ role: "user", parts: [{ text: userData.message }] });
toggleSuggestions(); // Suggested Messages লুকান

setTimeout(() => {
// Generate bot message HTML and add in the chat container
const botMsgHTML = `<img class="avatar" src="https://brandlogo.org/wp-content/uploads/2024/06/Gemini-Icon.png.webp" /> <p class="message-text">Just a sec...</p>`;
const botMsgDiv = createMessageElement(botMsgHTML, "bot-message", "loading");
chatsContainer.appendChild(botMsgDiv);
scrollToBottom();
generateResponse(botMsgDiv);
}, 600); // 600 ms delay
};

// Handle file input change (file upload)
fileInput.addEventListener("change", () => {
const file = fileInput.files[0];
if (!file) return;

const isImage = file.type.startsWith("image/");
const reader = new FileReader();
reader.readAsDataURL(file);

reader.onload = (e) => {
fileInput.value = "";
const base64String = e.target.result.split(",")[1];
fileUploadWrapper.querySelector(".file-preview").src = e.target.result;
fileUploadWrapper.classList.add("active", isImage ? "img-attached" : "file-attached");

// Store file data in userData obj
userData.file = { fileName: file.name, data: base64String, mime_type: file.type, isImage };
};
});

// Cancel file upload
document.querySelector("#cancel-file-btn").addEventListener("click", () => {
userData.file = {};
fileUploadWrapper.classList.remove("file-attached", "img-attached", "active");
});

// Stop Bot Response
document.querySelector("#stop-response-btn").addEventListener("click", () => {
controller?.abort();
userData.file = {};
clearInterval(typingInterval);
chatsContainer.querySelector(".bot-message.loading").classList.remove("loading");
document.body.classList.remove("bot-responding");
});

// Toggle dark/light theme
themeToggleBtn.addEventListener("click", () => {
const isLightTheme = document.body.classList.toggle("light-theme");
localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");
themeToggleBtn.textContent = isLightTheme ? "dark_mode" : "light_mode";
});

// Delete all chats
document.querySelector("#delete-chats-btn").addEventListener("click", () => {
chatHistory = [];
localStorage.removeItem("chatHistory"); // Local Storage থেকে চ্যাট হিস্টরি ডিলিট করুন
chatsContainer.innerHTML = "";
document.body.classList.remove("chats-active", "bot-responding");
toggleSuggestions(); // Suggested Messages দেখান
});

// Handle suggestions click
document.querySelectorAll(".suggestions-item").forEach((suggestion) => {
suggestion.addEventListener("click", () => {
promptInput.value = suggestion.querySelector(".text").textContent;
promptForm.dispatchEvent(new Event("submit"));
});
});

// Show/hide controls for mobile on prompt input focus
document.addEventListener("click", ({ target }) => {
const wrapper = document.querySelector(".prompt-wrapper");
const shouldHide = target.classList.contains("prompt-input") || (wrapper.classList.contains("hide-controls") && (target.id === "add-file-btn" || target.id === "stop-response-btn"));
wrapper.classList.toggle("hide-controls", shouldHide);
});

// Add event listeners for form submission and file input click
promptForm.addEventListener("submit", handleFormSubmit);
promptForm.querySelector("#add-file-btn").addEventListener("click", () => fileInput.click());

// পেজ লোড হওয়ার সময় চ্যাট হিস্টরি লোড করুন
window.addEventListener("load", loadChatHistory);