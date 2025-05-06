// ... (Önceki DOM element seçimleri aynı) ...
const planForm = document.getElementById('plan-form');
const topicInput = document.getElementById('topic');
const durationInput = document.getElementById('duration');
const levelSelect = document.getElementById('level');
const submitButton = document.getElementById('submit-button');
const loadingDiv = document.getElementById('loading');
const errorMessageDiv = document.getElementById('error-message');
const planResultDiv = document.getElementById('plan-result');

const chatbotContainer = document.getElementById('chatbot-container');
const closeChatbotButton = document.getElementById('close-chatbot');
const chatbotMessagesDiv = document.getElementById('chatbot-messages');
const chatbotInput = document.getElementById('chatbot-input');
const chatbotSendButton = document.getElementById('chatbot-send');
const chatbotContextSpan = document.querySelector('#chatbot-context span');
const chatbotContextDiv = document.getElementById('chatbot-context');
const aiTypingDiv = document.getElementById('ai-typing');
const openChatbotButton = document.getElementById('open-chatbot-button'); // YENİ FAB Butonu


// --- YENİ: Chatbot Geçmişi ve Bağlamı ---
let chatHistory = []; // Konuşma geçmişini tutacak dizi
let currentChatbotContext = null; // Mevcut adım bağlamı
let currentStepTitle = null; // Mevcut adım başlığı (arayüz için)


// --- Plan Oluşturma Formu Olay Dinleyicisi (Aynı) ---
planForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    planResultDiv.innerHTML = '';
    errorMessageDiv.innerHTML = '';
    errorMessageDiv.classList.add('hidden');
    chatbotContainer.classList.remove('visible'); // GÖRÜNÜRLÜK SINIFI
    chatbotContainer.classList.add('hidden');     // DISPLAY:NONE SINIFI
    loadingDiv.classList.remove('hidden');
    submitButton.disabled = true;

    const requestData = {
        topic: topicInput.value,
        duration: durationInput.value,
        level: levelSelect.value
    };

    try {
        // ... (fetch ve hata yönetimi aynı) ...
         const response = await fetch('http://127.0.0.1:8000/create-plan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            body: JSON.stringify(requestData)
        });

         if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Sunucudan hata alındı: ${response.status}`);
        }

         const planData = await response.json();
         displayPlan(planData); // displayPlan şimdi butonları da ekleyecek

    } catch (error) {
        console.error("Hata oluştu:", error);
        displayError(`Plan oluşturulurken bir hata oluştu: ${error.message}`);
    } finally {
        loadingDiv.classList.add('hidden');
        submitButton.disabled = false;
    }
});

// --- Öğrenme Planını Gösterme Fonksiyonu (GÜNCELLENDİ) ---
function displayPlan(data) {
    planResultDiv.innerHTML = '';

    // ... (Başlık ve Seviye gösterimi aynı) ...
    const titleElement = document.createElement('h2');
    titleElement.textContent = data.plan_title || 'Öğrenme Planı';
    planResultDiv.appendChild(titleElement);

    const levelElement = document.createElement('p');
    levelElement.textContent = `Seviye: ${data.level || 'Belirtilmemiş'}`;
    planResultDiv.appendChild(levelElement);


    if (data.schedule && data.schedule.length > 0) {
        data.schedule.forEach((stepData, index) => {
            const stepDiv = document.createElement('div');
            stepDiv.classList.add('plan-step');
            stepDiv.id = `step-${index}`;

            // ... (Adım başlığı, hedef, konular, kaynaklar gösterimi aynı) ...
             const stepTitle = document.createElement('h3');
            stepTitle.textContent = stepData.step || 'Adım';
            stepDiv.appendChild(stepTitle);

            const stepGoal = document.createElement('p');
            stepGoal.innerHTML = `<strong>Hedef:</strong> ${stepData.goal || 'Belirtilmemiş'}`;
            stepDiv.appendChild(stepGoal);

             if (stepData.topics && stepData.topics.length > 0) { /* ... konular listesi ... */
                 const topicsTitle = document.createElement('h4');
                topicsTitle.textContent = 'Konular:';
                stepDiv.appendChild(topicsTitle);
                const topicsList = document.createElement('ul');
                stepData.topics.forEach(topic => {
                    const listItem = document.createElement('li');
                    listItem.textContent = topic;
                    topicsList.appendChild(listItem);
                });
                stepDiv.appendChild(topicsList);
             }
             if (stepData.resources && stepData.resources.length > 0) { /* ... kaynaklar listesi ... */
                const resourcesTitle = document.createElement('h4');
                resourcesTitle.textContent = 'Kaynaklar:';
                stepDiv.appendChild(resourcesTitle);
                const resourcesList = document.createElement('ul');
                stepData.resources.forEach(resource => {
                    const listItem = document.createElement('li');
                    const link = document.createElement('a');
                    link.href = resource.url;
                    link.textContent = resource.name || 'Kaynak Linki';
                    link.target = '_blank';
                    listItem.appendChild(link);
                    resourcesList.appendChild(listItem);
                });
                stepDiv.appendChild(resourcesList);
             }


            // AI Asistan Butonu (Aynı)
            const askAiButton = document.createElement('button');
            askAiButton.textContent = '🤖 AI Asistana Sor';
            askAiButton.classList.add('ask-ai-button');
            const context = `Adım: ${stepData.step || 'Bilinmiyor'}\nHedef: ${stepData.goal || 'Belirtilmemiş'}\nKonular: ${(stepData.topics || []).join(', ')}`;
            askAiButton.dataset.context = context;
            askAiButton.dataset.stepTitle = stepData.step || 'Bu Adım';

            askAiButton.addEventListener('click', (event) => {
                // Tıklanan butondan bilgileri al
                const btn = event.currentTarget;
                openChatbotWithContext(btn.dataset.context, btn.dataset.stepTitle);
            });

            stepDiv.appendChild(askAiButton);
            planResultDiv.appendChild(stepDiv);
        });
    } else {
        planResultDiv.innerHTML += '<p>Plan içeriği bulunamadı.</p>';
    }
}

// --- Hata Gösterme (Aynı) ---
function displayError(message) {
    errorMessageDiv.textContent = message;
    errorMessageDiv.classList.remove('hidden');
}

// --- Chatbot Fonksiyonları (GÜNCELLENDİ) ---

// Chatbot açma/kapama
function toggleChatbot() {
    // Önce display:none kaldırılır, sonra animasyon için sınıf eklenir/kaldırılır
    if (chatbotContainer.classList.contains('hidden')) {
         chatbotContainer.classList.remove('hidden'); // Önce display none kaldır
         // Küçük bir gecikme ile animasyon sınıfını ekle (CSS transition çalışması için)
         setTimeout(() => chatbotContainer.classList.add('visible'), 10);
    } else {
        chatbotContainer.classList.remove('visible'); // Önce animasyon sınıfını kaldır
         // Animasyon bittikten sonra display none ekle
        chatbotContainer.addEventListener('transitionend', () => {
            chatbotContainer.classList.add('hidden');
        }, { once: true }); // Olay dinleyici bir kere çalışıp kendini kaldırsın
    }
}


openChatbotButton.addEventListener('click', toggleChatbot);
closeChatbotButton.addEventListener('click', toggleChatbot);


// Chatbot'u belirli bir bağlamla açar (ve geçmişi temizler)
function openChatbotWithContext(context, stepTitle) {
    console.log("Yeni bağlam:", stepTitle);
    currentChatbotContext = context;
    currentStepTitle = stepTitle;
    chatbotContextSpan.textContent = currentStepTitle;
    chatbotContextDiv.classList.remove('hidden');

    // --- YENİ: Geçmişi ve mesajları temizle ---
    chatHistory = [];
    chatbotMessagesDiv.innerHTML = ''; // Mesaj alanını boşalt
    // Başlangıç mesajı ekle (ve geçmişe ekle)
    const initialMessage = `Merhaba! "${currentStepTitle}" adımıyla ilgili sorularını yanıtlayabilirim.`;
    addMessageToChat(initialMessage, 'ai', false); // false: geçmişe ekleme (backend'e göndermeyeceğiz)

    // Chatbot penceresini görünür yap (eğer zaten açık değilse)
     if (chatbotContainer.classList.contains('hidden')) {
         toggleChatbot(); // Açma fonksiyonunu çağır
    }
    chatbotInput.focus(); // Yazma alanına odaklan
    scrollToBottom(chatbotMessagesDiv);
}

// Mesaj gönderme (Enter veya Buton)
chatbotSendButton.addEventListener('click', sendChatMessage);
chatbotInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) { // Shift+Enter yeni satır yapar, sadece Enter gönderir
        event.preventDefault(); // Enter'ın varsayılan yeni satırını engelle
        sendChatMessage();
    }
});

async function sendChatMessage() {
    const userQuestion = chatbotInput.value.trim();
    if (!userQuestion) return;

    // Bağlam seçili mi kontrolü (eskisi gibi)
    if (!currentChatbotContext) {
        addMessageToChat("Lütfen önce bir öğrenme adımındaki 'AI Asistana Sor' butonuna tıklayın.", 'ai', false); // Geçmişe ekleme
        return;
    }

    addMessageToChat(userQuestion, 'user'); // Kullanıcı mesajını ekle (ve geçmişe)
    const currentQuestion = chatbotInput.value.trim(); // Input temizlenmeden önce sakla
    chatbotInput.value = ''; // Input'u temizle
    aiTypingDiv.classList.remove('hidden');
    scrollToBottom(chatbotMessagesDiv);
    chatbotSendButton.disabled = true; // Gönderirken butonu kilitle

    try {
        const response = await fetch('http://127.0.0.1:8000/ask-assistant', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'accept': 'application/json'
            },
            body: JSON.stringify({
                question: currentQuestion, // Saklanan soru
                context: currentChatbotContext,
                history: chatHistory // YENİ: Konuşma geçmişini gönder
            })
        });

        aiTypingDiv.classList.add('hidden');

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Asistan yanıt vermedi: ${response.status}`);
        }

        const assistantData = await response.json();
        addMessageToChat(assistantData.answer || "Bir yanıt alamadım.", 'ai'); // AI mesajını ekle (ve geçmişe)

    } catch (error) {
        aiTypingDiv.classList.add('hidden');
        console.error("Asistan Hatası:", error);
        // Hata mesajını da geçmişe eklemeyebiliriz, sadece arayüzde gösterilir
        addMessageToChat(`Asistandan yanıt alınırken hata oluştu: ${error.message}`, 'ai', false);
    } finally {
         chatbotSendButton.disabled = false; // Butonu tekrar aç
         chatbotInput.focus(); // Tekrar yazma alanına odaklan
    }
}

// Chat penceresine mesaj ekleme fonksiyonu (GÜNCELLENDİ)
function addMessageToChat(message, sender, addToHistory = true) { // addToHistory parametresi eklendi
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');
    messageDiv.textContent = message; // Güvenlik için textContent kullan
    chatbotMessagesDiv.appendChild(messageDiv);

    // YENİ: Mesajı konuşma geçmişine ekle (eğer isteniyorsa)
    if (addToHistory) {
        chatHistory.push({
            // Gemini API'si genellikle 'assistant' yerine 'model' rolünü bekler
            role: sender === 'user' ? 'user' : 'model',
            // Gemini API'si 'content' yerine 'parts' bekleyebilir, tek parça metin için:
            parts: [{ text: message }]
        });
        console.log("Updated History:", chatHistory); // Geçmişi konsola yazdır (debug için)
    }

    scrollToBottom(chatbotMessagesDiv);
}

// Chat penceresini en alta kaydırma (Aynı)
function scrollToBottom(element) {
    element.scrollTop = element.scrollHeight;
}