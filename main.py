import uvicorn
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import google.generativeai as genai
import google.ai.generativelanguage as glm # YENİ: Mesaj tipleri için
import os
import json
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional # YENİ: Tipler için


load_dotenv()
app = FastAPI(title="Kişiselleştirilmiş Çalışma Planı Oluşturucu API", version="0.1.0")

origins = ["*"]
app.add_middleware( CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Gemini API Yapılandırması (Aynı)
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
model = None
if GOOGLE_API_KEY:
    try:
        genai.configure(api_key=GOOGLE_API_KEY)
        # Chat için 'gemini-pro' genellikle daha uygundur, 1.5-flash da çalışır
        model = genai.GenerativeModel('gemini-1.5-flash-latest') # Veya 'gemini-pro'
        print("Gemini API başarıyla yapılandırıldı.")
    except Exception as e:
        print(f"HATA: Gemini API yapılandırılamadı: {e}")
else:
     print("HATA: GOOGLE_API_KEY ortam değişkeni bulunamadı.")


# --- API Modelleri (GÜNCELLENDİ) ---

class PlanRequest(BaseModel):
    topic: str
    duration: str
    level: str = "Başlangıç"

# YENİ: Konuşma Geçmişi Mesaj Modeli (Gemini formatına uygun)
class ChatMessagePart(BaseModel):
     text: str

class ChatMessage(BaseModel):
    role: str # 'user' veya 'model'
    parts: List[ChatMessagePart]


class AssistantRequest(BaseModel):
    question: str = Field(..., description="Kullanıcının asistana sorduğu soru")
    context: str = Field(..., description="Öğrenme planındaki ilgili adımın bağlam bilgisi")
    # Optional yaptık, ilk mesajda gelmeyebilir
    history: Optional[List[ChatMessage]] = Field(None, description="Önceki konuşma mesajları")


class AssistantResponse(BaseModel):
    answer: str

class QuestionsRequest(BaseModel):
    topic: str
    level: str
    number: int


# --- Prompt Fonksiyonları ---

def create_plan_prompt(topic: str, duration: str, level: str) -> str:
    # ... (Plan prompt içeriği aynı) ...
    return f"""
Sen uzman bir eğitim danışmanısın. Aşağıdaki görevleri yerine getir:
1. Kullanıcının '{topic}' konusunu '{duration}' süresinde öğrenmesi için kişiselleştirilmiş, adım adım bir çalışma planı oluştur.
2. Kullanıcının seviyesinin '{level}' olduğunu varsay.
3. Planı günlük veya haftalık mantıklı adımlara böl (süreye göre karar ver, örneğin 1 hafta ise günlük, 1 ay ise haftalık olabilir).
4. Her adım için öğrenilecek ana konu başlıklarını listele.
5. Her adım için 1-2 adet ÜCRETSİZ ve GÜVENİLİR online kaynak (örneğin resmi dokümantasyonlar, bilinen eğitim siteleri, kaliteli blog yazıları veya YouTube videoları) öner. Kaynakların adını ve URL'sini belirt.
6. Çıktıyı SADECE ve SADECE geçerli bir JSON formatında ver. Başka hiçbir açıklama veya metin ekleme. JSON yapısı şu şekilde olmalı:
{{
  "plan_title": "Öğrenilecek Konu - Süre",
  "level": "Belirtilen Seviye",
  "schedule": [
    {{
      "step": "1. Gün" veya "1. Hafta",
      "goal": "Bu adımın ana hedefi",
      "topics": [
        "Konu Başlığı 1",
        "Konu Başlığı 2"
      ],
      "resources": [
        {{"name": "Kaynak Adı 1", "url": "https://kaynak_linki_1.com"}},
        {{"name": "Kaynak Adı 2", "url": "https://kaynak_linki_2.com"}}
      ]
    }}
    // ... diğer adımlar ...
  ]
}}

Tekrar ediyorum: Sadece yukarıdaki yapıya uygun JSON çıktısı ver. Öncesinde veya sonrasında başka hiçbir yazı olmasın.
"""


# --- API Endpoint'leri ---

@app.post("/create-plan")
async def create_learning_plan(request: PlanRequest = Body(...)):
    # ... (Bu endpoint aynı kaldı) ...
    if not model:
         raise HTTPException(status_code=500, detail="Gemini API yapılandırılamadığı için plan oluşturulamıyor.")

    print(f"Plan oluşturma isteği alındı: Konu='{request.topic}', Süre='{request.duration}', Seviye='{request.level}'")
    prompt = create_plan_prompt(request.topic, request.duration, request.level)

    try:
        print("Gemini API'ye plan isteği gönderiliyor...")
        response = model.generate_content(prompt)
        print("Gemini API'den plan yanıtı alındı.")
        try:
            cleaned_response_text = response.text.strip().replace('```json', '').replace('```', '').strip()
            plan_json = json.loads(cleaned_response_text)
            print("Plan yanıtı başarıyla JSON olarak parse edildi.")
            return plan_json
        except json.JSONDecodeError as json_err:
             print(f"HATA: Gemini plan yanıtı JSON olarak parse edilemedi: {json_err}")
             print("--- Gemini'den Gelen Ham Plan Yanıtı ---")
             print(response.text)
             print("--- Ham Plan Yanıt Sonu ---")
             raise HTTPException(status_code=500, detail=f"Yapay zeka modeli geçerli bir plan formatı döndürmedi. Ham yanıt: {response.text}")
        except AttributeError:
            print(f"HATA: Gemini'den geçerli bir plan yanıtı alınamadı.")
            print(f"Gemini plan yanıt objesi: {response}")
            raise HTTPException(status_code=500, detail="Yapay zeka modelinden geçerli bir plan yanıtı alınamadı.")

    except Exception as e:
        print(f"HATA: Plan için Gemini API çağrısı sırasında bir hata oluştu: {e}")
        raise HTTPException(status_code=500, detail=f"Plan oluşturulurken yapay zeka modeliyle iletişimde hata: {e}")


# Chatbot Asistan endpoint'i (GÜNCELLENDİ)
@app.post("/ask-assistant", response_model=AssistantResponse)
async def ask_assistant(request: AssistantRequest = Body(...)):
    if not model:
         raise HTTPException(status_code=500, detail="Gemini API yapılandırılamadığı için asistan yanıt veremiyor.")

    print(f"Asistan isteği alındı: Soru='{request.question}', Bağlam='{request.context[:100]}...', Geçmiş Mesaj Sayısı={len(request.history) if request.history else 0}")

    # --- YENİ: Konuşma Geçmişini Hazırlama ---
    # Sistem talimatını ve bağlamı başa ekleyelim
    system_instruction = f"""Sen yardımsever bir AI öğrenme asistanısın. Görevin, kullanıcının sorduğu soruları, ona sağlanan ÖĞRENME BAĞLAMI çerçevesinde yanıtlamaktır. Cevaplarını kısa, net ve anlaşılır tut. Bağlam dışı sorulara kibarca yanıt ver.

ÖĞRENME BAĞLAMI:
---
{request.context}
---
"""
    # Gemini API'sinin beklediği formatta geçmişi oluştur
    gemini_history = []
    # İlk mesaj olarak sistem talimatını ekleyebiliriz (bazı modeller destekler)
    # gemini_history.append(glm.Content(role="system", parts=[glm.Part(text=system_instruction)]))
    # VEYA talimatı ilk kullanıcı mesajının bir parçası gibi düşünebiliriz.
    # Şimdilik talimatı prompt'un başına ekleyeceğiz, geçmişi olduğu gibi kullanacağız.

    if request.history:
         # Pydantic modellerini Gemini'nin Content objelerine dönüştür
         for msg in request.history:
             try:
                # Frontend'den gelen parts listesindeki her bir part'ı glm.Part'a çevir
                gemini_parts = [glm.Part(text=part.text) for part in msg.parts]
                gemini_history.append(glm.Content(role=msg.role, parts=gemini_parts))
             except Exception as e:
                 print(f"Geçmiş mesajı dönüştürme hatası: {e} - Mesaj: {msg}")
                 # Hatalı mesajı atlayabilir veya loglayabiliriz
                 continue


    # --- YENİ: Gemini Chat Kullanımı ---
    try:
        # Konuşmayı başlat (geçmişle birlikte)
        # Sistem talimatını chat'e başlangıçta verebiliriz (önerilen)
        chat = model.start_chat(history=gemini_history)

        # Mevcut soruyu gönder
        print(f"Gemini Chat'e mesaj gönderiliyor: {request.question}")
        # Sistem talimatını her seferinde göndermek yerine start_chat içinde halletmek daha iyi
        # response = chat.send_message(system_instruction + "\nKULLANICI SORUSU: " + request.question)
        response = chat.send_message(request.question) # Sadece soruyu gönder
        print("Gemini Chat'ten yanıt alındı.")

        try:
            assistant_answer = response.text.strip()
            print("Asistan yanıtı:", assistant_answer[:100] + "...") # Yanıtın başını logla
            return AssistantResponse(answer=assistant_answer)
        except AttributeError:
            print(f"HATA: Gemini Chat'ten geçerli yanıt alınamadı (text özelliği yok).")
            print(f"Gemini yanıt objesi: {response}")
            print(f"Prompt Feedback: {response.prompt_feedback if hasattr(response, 'prompt_feedback') else 'N/A'}")
            raise HTTPException(status_code=500, detail="Yapay zeka modelinden geçerli bir yanıt alınamadı. İçerik filtrelenmiş olabilir.")
        except Exception as inner_e:
             print(f"HATA: Asistan yanıtı işlenirken hata: {inner_e}")
             raise HTTPException(status_code=500, detail=f"Asistan yanıtı işlenirken hata: {inner_e}")


    except Exception as e:
        print(f"HATA: Asistan için Gemini API çağrısı sırasında bir hata oluştu: {e}")
        # Hata detaylarını loglamak önemli
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Asistanla iletişimde hata: {e}")

# --Boşluk doldurma soruları oluşturma metodu
@app.post("/generate-questions")
async def generate_questions(request: QuestionsRequest = Body(...)):
    if not model:
        raise HTTPException(status_code=500, detail="Gemini API yapılandırılamadığı için sorular oluşturulamıyor.")

    prompt = f"""Bana {request.topic} konusu hakkında {request.level} seviyesinde {request.number} tane boşluk doldurmalı soru hazırlamanı istiyorum. 
    Ve bundan sonra tüm sorular bittikten sonra alta da çözümlerini yazmanı istiyorum.
    
    Lütfen yanıtını şu formatta ver:
    
    SORULAR:
    1. [Soru metni]
    2. [Soru metni]
    ...
    
    ÇÖZÜMLER:
    1. [Çözüm]
    2. [Çözüm]
    ..."""

    try:
        response = model.generate_content(prompt)
        return {"questions_and_answers": response.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sorular oluşturulurken hata: {e}")

@app.get("/")
async def read_root():
    return FileResponse("questions.html")

# Ana Uygulamayı Çalıştırma (Aynı)
if __name__ == "__main__":
    print("API sunucusu başlatılıyor...")
    print("Swagger UI (Test Arayüzü) için: http://127.0.0.1:8000/docs")
    uvicorn.run(app, host="127.0.0.1", port=8000)
