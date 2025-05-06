// questions.js
document.addEventListener('DOMContentLoaded', () => {
    const questionsForm = document.getElementById('questions-form');
    const topicInput = document.getElementById('topic');
    const levelSelect = document.getElementById('level');
    const numberInput = document.getElementById('number');
    const submitButton = document.getElementById('submit-questions-button');
    const loadingDiv = document.getElementById('loading-questions');
    const errorMessageDiv = document.getElementById('error-message-questions');
    const questionsResultContainer = document.getElementById('questions-result-container');

    questionsForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        questionsResultContainer.innerHTML = '';
        errorMessageDiv.textContent = '';
        errorMessageDiv.classList.add('hidden');
        loadingDiv.classList.remove('hidden');
        submitButton.disabled = true;
        const originalButtonText = submitButton.textContent;
        submitButton.innerHTML = `<span class="spinner !border-left-white !w-5 !h-5 inline-block mr-2"></span> Oluşturuluyor...`;

        const requestData = {
            topic: topicInput.value,
            level: levelSelect.value,
            number: parseInt(numberInput.value, 10)
        };

        try {
            const response = await fetch('http://127.0.0.1:8001/generate-questions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'accept': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: `Sunucudan hata alındı: ${response.status}` }));
                throw new Error(errorData.detail || `Sunucudan hata alındı: ${response.status}`);
            }

            const resultData = await response.json();
            displayQuestions(resultData.questions_and_answers);

        } catch (error) {
            console.error("Hata oluştu:", error);
            displayErrorQuestions(`Sorular oluşturulurken bir hata oluştu: ${error.message}`);
        } finally {
            loadingDiv.classList.add('hidden');
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonText;
        }
    });

    function displayQuestions(data) {
        questionsResultContainer.innerHTML = ''; // Önceki sonuçları temizle

        if (!data || data.trim() === "") {
            questionsResultContainer.innerHTML = '<p class="text-center text-gray-500">Yapay zekadan bir yanıt alınamadı veya yanıt boş.</p>';
            return;
        }

        // Gelen metni "SORULAR:" ve "ÇÖZÜMLER:" bölümlerine ayıralım
        // Modelin tam olarak bu başlıkları kullanacağını varsayıyoruz.
        // Büyük/küçük harf duyarsız arama ve esnek boşluklar için regex kullanalım.
        const sections = data.split(/ÇÖZÜMLER:\s*/i);
        const questionsText = sections[0].replace(/SORULAR:\s*/i, '').trim();
        const solutionsText = sections.length > 1 ? sections[1].trim() : "";

        let questionsHtml = '<h3>Sorular</h3>';
        if (questionsText) {
            questionsHtml += '<ol class="list-decimal list-inside space-y-2 mb-6">';
            questionsText.split('\n').forEach(line => {
                line = line.trim();
                if (line) {
                    // Soru numaralarını (örn: "1. ", "2. ") kaldırıp sadece metni alalım, ol zaten numaralandıracak
                    const questionItem = line.replace(/^\d+\.\s*/, '');
                    if(questionItem) questionsHtml += `<li class="text-gray-700">${questionItem.replace(/___+/g, '<strong class="text-blue-500">(boşluk)</strong>')}</li>`;
                }
            });
            questionsHtml += '</ol>';
        } else {
            questionsHtml += '<p class="text-gray-500">Soru bulunamadı.</p>';
        }


        let solutionsHtml = '<h3>Çözümler</h3>';
        if (solutionsText) {
            solutionsHtml += '<ol class="list-decimal list-inside space-y-2">';
            solutionsText.split('\n').forEach(line => {
                line = line.trim();
                if (line) {
                    const solutionItem = line.replace(/^\d+\.\s*/, '');
                     if(solutionItem) solutionsHtml += `<li class="text-gray-600"><strong class="font-semibold text-green-600">${solutionItem}</strong></li>`;
                }
            });
            solutionsHtml += '</ol>';
        } else {
            solutionsHtml += '<p class="text-gray-500">Çözüm bulunamadı.</p>';
        }

        // Tailwind'in "prose" sınıfı metin formatlamasını güzelleştirir.
        const formattedOutput = `
            <div class="bg-white p-6 rounded-lg shadow-md prose max-w-none prose-indigo">
                ${questionsHtml}
                ${solutionsHtml}
            </div>
        `;
        questionsResultContainer.innerHTML = formattedOutput;
    }

    function displayErrorQuestions(message) {
        errorMessageDiv.innerHTML = `<p class="font-medium">Hata!</p><p>${message}</p>`; // HTML desteklesin
        errorMessageDiv.classList.remove('hidden');
    }
});