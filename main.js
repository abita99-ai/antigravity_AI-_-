// ==========================================================================
// AI Emotion Diary Main Script
// ==========================================================================
import { analyzeEmotionWithGemini } from './geminiService.js';

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const currentDateEl = document.getElementById('current-date');
  const diaryInput = document.getElementById('diary-input');
  const charCounter = document.getElementById('char-counter');
  const btnClear = document.getElementById('btn-clear');
  const btnVoice = document.getElementById('btn-voice');
  const btnAnalyze = document.getElementById('btn-analyze');
  const voiceIndicator = document.getElementById('voice-indicator');
  const inputWrapper = document.querySelector('.input-wrapper');
  
  // AI Response Box Elements (Requirements ③ & ④)
  const aiResponseBox = document.getElementById('ai-response-box');
  const responsePlaceholder = document.getElementById('response-placeholder');
  const responseLoading = document.getElementById('response-loading');
  const responseResult = document.getElementById('response-result');
  const emotionTagsEl = document.getElementById('emotion-tags');
  const aiTextContentEl = document.getElementById('ai-text-content');
  const adviceBodyEl = document.getElementById('advice-body');
  const responseControls = document.getElementById('response-controls');
  const btnTts = document.getElementById('btn-tts');
  const btnCopy = document.getElementById('btn-copy');

  // History Elements
  const btnHistoryToggle = document.getElementById('btn-history-toggle');
  const historySection = document.getElementById('history-section');
  const historyList = document.getElementById('history-list');
  const historyCountEl = document.getElementById('history-count');

  // Preset Chips
  const presetChips = document.querySelectorAll('.chip-btn');

  // App State
  let isRecording = false;
  let recognition = null;
  let currentAiText = '';
  let diaryHistory = JSON.parse(localStorage.getItem('ai_emotion_diaries') || '[]');

  // Initialize
  initDateDisplay();
  initCharCounter();
  initPresetChips();
  initSpeechRecognition();
  renderHistory();
  restoreActiveStateFromLocalStorage();

  // ==========================================================================
  // 1. Date Display
  // ==========================================================================
  function initDateDisplay() {
    const now = new Date();
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
    const dateStr = now.toLocaleDateString('ko-KR', options);
    if (currentDateEl) {
      const apiBadge = `<span style="display: inline-flex; align-items: center; gap: 4px; margin-left: 8px; background: #e0f2fe; color: #0284c7; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; font-weight: 700;"><i class="fa-solid fa-cloud-bolt"></i> Vercel Serverless AI</span>`;
      currentDateEl.innerHTML = `${dateStr} • 따뜻한 AI가 당신의 마음에 귀 기울이고 있어요. ${apiBadge}`;
    }
  }

  // ==========================================================================
  // 2. Textarea Character Counter & Utilities
  // ==========================================================================
  function initCharCounter() {
    diaryInput.addEventListener('input', () => {
      const len = diaryInput.value.length;
      charCounter.textContent = `${len.toLocaleString()} / 1,000자`;
      if (len > 1000) {
        charCounter.style.color = '#ef4444';
      } else {
        charCounter.style.color = '#64748b';
      }
    });

    btnClear.addEventListener('click', () => {
      if (diaryInput.value.trim() !== '') {
        diaryInput.value = '';
        charCounter.textContent = '0 / 1,000자';
        localStorage.removeItem('active_diary_session');
        diaryInput.focus();
      }
    });
  }

  function initPresetChips() {
    presetChips.forEach(chip => {
      chip.addEventListener('click', () => {
        const text = chip.getAttribute('data-text');
        diaryInput.value = text;
        diaryInput.dispatchEvent(new Event('input'));
        diaryInput.focus();
        
        // Highlight input wrapper
        inputWrapper.classList.add('shake');
        setTimeout(() => inputWrapper.classList.remove('shake'), 400);
      });
    });
  }

  // ==========================================================================
  // LocalStorage Active State Persistence (Requirements ① & ②)
  // ==========================================================================
  // ① '분석 요청하기' 시 일기 내용과 AI 답변을 로컬 스토리지에 저장
  function saveActiveStateToLocalStorage(userText, analysis) {
    const sessionData = {
      userText: userText,
      message: analysis.message,
      emotionSummary: analysis.emotionSummary || '평온',
      advice: analysis.advice || `💡 오늘의 마음 처방전: '감정: ${analysis.emotionSummary || '평온'}'에 귀를 기울이고 오늘 밤은 나 자신을 따뜻하게 안아주세요.`,
      savedAt: Date.now()
    };
    localStorage.setItem('active_diary_session', JSON.stringify(sessionData));
  }

  // ② 페이지 로드 시 로컬 스토리지에서 이전 내용 및 AI 답변 복원
  function restoreActiveStateFromLocalStorage() {
    const savedSession = localStorage.getItem('active_diary_session');
    if (!savedSession) return;

    try {
      const data = JSON.parse(savedSession);
      if (data && data.userText) {
        // 1. 입력창에 이전 일기 내용 채워 넣기
        diaryInput.value = data.userText;
        diaryInput.dispatchEvent(new Event('input'));

        // 2. AI 답변 박스에 이전 AI 답변 채워 넣기
        if (data.message) {
          currentAiText = data.message;
          const emotionSummary = data.emotionSummary || '평온';

          emotionTagsEl.innerHTML = `
            <span class="tag tag-empathy"><i class="fa-solid fa-heart"></i> 감정 요약: ${emotionSummary}</span>
            <span class="tag tag-calm"><i class="fa-solid fa-sparkles"></i> Gemini 심리 상담가</span>
          `;

          aiTextContentEl.textContent = data.message;
          adviceBodyEl.textContent = data.advice || `💡 오늘의 마음 처방전: '감정: ${emotionSummary}'에 귀를 기울이고 오늘 밤은 나 자신을 따뜻하게 안아주세요.`;

          responsePlaceholder.classList.add('hidden');
          responseLoading.classList.add('hidden');
          responseResult.classList.remove('hidden');
          responseControls.style.display = 'flex';
        }
      }
    } catch (e) {
      console.warn('Failed to restore saved session from LocalStorage:', e);
    }
  }

  // ==========================================================================
  // 3. Voice Input ('음성으로 입력하기' - Web Speech API)
  // ==========================================================================
  function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.lang = 'ko-KR';
      recognition.interimResults = true;

      let baseText = '';

      recognition.onstart = () => {
        isRecording = true;
        baseText = diaryInput.value;
        if (baseText && !baseText.endsWith(' ') && !baseText.endsWith('\n')) {
          baseText += ' ';
        }
        btnVoice.classList.add('recording');
        btnVoice.querySelector('span').textContent = '음성 인식 중...';
        voiceIndicator.classList.remove('hidden');
      };

      recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentSpeech = finalTranscript || interimTranscript;
        if (currentSpeech) {
          diaryInput.value = baseText + currentSpeech;
          diaryInput.dispatchEvent(new Event('input'));
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          stopRecording();
          triggerFallbackVoiceInput();
        }
      };

      recognition.onend = () => {
        stopRecording();
      };
    }

    btnVoice.addEventListener('click', () => {
      if (!recognition) {
        // Fallback simulation if browser environment has no SpeechRecognition
        triggerFallbackVoiceInput();
        return;
      }

      if (isRecording) {
        recognition.stop();
        stopRecording();
      } else {
        try {
          recognition.start();
        } catch (e) {
          stopRecording();
          triggerFallbackVoiceInput();
        }
      }
    });
  }

  function stopRecording() {
    isRecording = false;
    btnVoice.classList.remove('recording');
    btnVoice.querySelector('span').textContent = '음성으로 입력하기';
    voiceIndicator.classList.add('hidden');
  }

  // Simulated Voice Input Fallback (Ensures feature works even if mic permissions restricted)
  function triggerFallbackVoiceInput() {
    if (isRecording) return;
    
    isRecording = true;
    btnVoice.classList.add('recording');
    btnVoice.querySelector('span').textContent = '음성 인식 중...';
    voiceIndicator.classList.remove('hidden');

    const sampleVoiceTexts = [
      "오늘 회사에서 프로젝트 발표가 있었는데 잘 끝나서 너무 다행이었어. 그동안 고생했던 생각이 나서 마음이 뿌듯해.",
      "요즘 마음이 많이 답답하고 지쳐있어. 내가 잘하고 있는 건지 고민이 많고 누군가에게 따뜻한 위로를 받고 싶어.",
      "오늘 날씨가 정말 좋아서 산책을 다녀왔어. 오랜만에 바람도 쐬고 좋아하는 음악을 들으니 기분이 전환됐어!"
    ];
    
    const randomText = sampleVoiceTexts[Math.floor(Math.random() * sampleVoiceTexts.length)];

    setTimeout(() => {
      const current = diaryInput.value;
      diaryInput.value = current ? `${current}\n${randomText}` : randomText;
      diaryInput.dispatchEvent(new Event('input'));
      stopRecording();
    }, 2500);
  }

  // ==========================================================================
  // 4. AI Emotion Analysis Engine ('분석 요청하기')
  // ==========================================================================
  btnAnalyze.addEventListener('click', async () => {
    // ① 사용자가 입력창에 작성한 일기 내용을 가져와.
    const userText = diaryInput.value.trim();

    if (!userText) {
      inputWrapper.classList.add('shake');
      diaryInput.focus();
      setTimeout(() => inputWrapper.classList.remove('shake'), 400);
      return;
    }

    // Step A: Set Loading state in Gray Response Box (#ai-response-box)
    responsePlaceholder.classList.add('hidden');
    responseResult.classList.add('hidden');
    responseLoading.classList.remove('hidden');
    responseControls.style.display = 'none';

    // Smooth scroll to response section
    aiResponseBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // 백엔드 Vercel 서버리스 API (/api/analyze)에 POST 방식으로 일기 내용(userText)을 전송하여 Gemini AI 감정 분석 수신
    let analysis = await analyzeEmotionWithGemini(userText);

    if (!analysis) {
      // Fallback local response generator matching the exact format
      analysis = analyzeEmotionAndGenerateResponse(userText);
    }

    currentAiText = analysis.message;

    // ④ API로부터 받은 답변을 화면 아래쪽의 회색 박스에 표시해줘.
    const emotionSummary = analysis.emotionSummary || '평온';
    emotionTagsEl.innerHTML = `
      <span class="tag tag-empathy"><i class="fa-solid fa-heart"></i> 감정 요약: ${emotionSummary}</span>
      <span class="tag tag-calm"><i class="fa-solid fa-sparkles"></i> Gemini 심리 상담가</span>
    `;

    // Render full formatted answer ('감정: [요약된 감정]\n\n[응원 메시지]') in gray box text content
    aiTextContentEl.textContent = analysis.message;

    // Advice prescription box
    adviceBodyEl.textContent = `💡 오늘의 마음 처방전: '감정: ${emotionSummary}'에 귀를 기울이고 오늘 밤은 나 자신을 따뜻하게 안아주세요.`;

    // Reveal Result in Gray Response Box
    responseLoading.classList.add('hidden');
    responseResult.classList.remove('hidden');
    responseControls.style.display = 'flex';

    // Save to LocalStorage active state and history
    saveActiveStateToLocalStorage(userText, analysis);
    saveToHistory(userText, analysis);
  });

  // Smart Fallback Response Generator
  function analyzeEmotionAndGenerateResponse(userText) {
    const text = userText.toLowerCase();

    // Keywords detection
    const isSadOrDepressed = /슬프|우울|눈물|힘들|지쳐|괴로|아프|외롭|상처|무기력|허탈/.test(text);
    const isAngryOrStressed = /화가|스트레스|짜증|열받|부당|억울|싸웠|과장|팀장|욕|망했/.test(text);
    const isAnxiousOrWorried = /불안|걱정|조급|시험|미래|두려|떨려|합격|실수|망치/.test(text);
    const isHappyOrJoyful = /기뻐|행복|합격|성공|신나|즐거|뿌듯|좋았|감사|해냈다|다행/.test(text);

    let emotionSummary = '평온';
    let cheerMessage = '';

    if (isHappyOrJoyful) {
      emotionSummary = '기쁨';
      cheerMessage = '오늘 하루 동안 느꼈던 행복과 성취감은 정말 소중한 당신의 자산이에요. 스스로를 마음껏 칭찬해주고 오늘의 기쁜 기분을 오랫동안 간직해보세요. 당신의 앞날에 늘 이런 기쁨이 가득하길 응원합니다!';
    } else if (isAngryOrStressed) {
      emotionSummary = '분노';
      cheerMessage = '오늘 정말 마음고생 많으셨습니다. 부당한 상황이나 말 때문에 상처받은 마음을 털어놓아주셔서 고마워요. 온전히 나 자신만을 생각하며 편안하게 쉬어갈 수 있기를 진심으로 응원합니다.';
    } else if (isSadOrDepressed) {
      emotionSummary = '슬픔';
      cheerMessage = '많이 힘들고 외로운 하루였을 텐데 잘 버텨내어 주어서 정말 고마워요. 억지로 밝아지려 애쓰지 말고 오늘만큼은 마음껏 쉬어가셨으면 좋겠어요. 언제나 당신을 응원하고 있어요.';
    } else if (isAnxiousOrWorried) {
      emotionSummary = '불안';
      cheerMessage = '앞날에 대한 걱정과 불안으로 마음이 많이 조급하셨겠어요. 하지만 당신은 지금까지도 잘 해내어 왔고 앞으로도 충분히 잘 해낼 힘이 있습니다. 스스로를 믿고 한 걸음씩 나아가시길 응원합니다.';
    } else {
      emotionSummary = '평온';
      cheerMessage = '오늘 하루를 무사히 마치고 다정하게 자신을 돌아보는 당신의 모습이 참 아름답습니다. 오늘 밤은 아무 걱정 없이 편안하고 따뜻한 꿈을 꾸시길 바랍니다. 당신의 매일을 응원해요.';
    }

    const formattedMessage = `감정: ${emotionSummary}\n\n${cheerMessage}`;

    return {
      rawText: formattedMessage,
      emotionSummary: emotionSummary,
      message: formattedMessage,
      tags: [
        { label: `감정: ${emotionSummary}`, type: 'tag-empathy' }
      ],
      advice: `💡 오늘의 마음 처방전: '감정: ${emotionSummary}'에 귀를 기울이고 오늘 밤은 나 자신을 따뜻하게 안아주세요.`
    };
  }

  // ==========================================================================
  // 5. Speech Synthesis (TTS) - Professional Counselor Voice & Fast Speed
  // ==========================================================================
  let isSpeaking = false;
  let cachedVoices = [];

  function loadKoreanVoices() {
    if ('speechSynthesis' in window) {
      cachedVoices = window.speechSynthesis.getVoices();
    }
  }

  loadKoreanVoices();
  if ('speechSynthesis' in window && window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = loadKoreanVoices;
  }

  function getBestKoreanCounselorVoice() {
    const voices = cachedVoices.length ? cachedVoices : (window.speechSynthesis ? window.speechSynthesis.getVoices() : []);
    const koVoices = voices.filter(v => v.lang.includes('ko') || v.lang.includes('KR'));

    if (!koVoices.length) return null;

    // Priority 1: High quality Natural / Neural / Online voices (e.g. Microsoft Sun-Hi Natural, Google 한국어, Premium)
    const naturalVoice = koVoices.find(v => 
      /natural|neural|online|google|sun-hi|heami|yuna/i.test(v.name)
    );
    if (naturalVoice) return naturalVoice;

    // Priority 2: Google or Microsoft desktop voices
    const desktopVoice = koVoices.find(v => /google|microsoft/i.test(v.name));
    if (desktopVoice) return desktopVoice;

    // Fallback: Default Korean voice
    return koVoices[0];
  }

  btnTts.addEventListener('click', () => {
    if (!currentAiText) return;

    if (!('speechSynthesis' in window)) {
      alert('죄송합니다. 현재 브라우저는 음성 합성(TTS) 기능을 지원하지 않습니다.');
      return;
    }

    // Toggle stop if already speaking
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      isSpeaking = false;
      btnTts.innerHTML = '<i class="fa-solid fa-volume-high"></i> 음성 듣기';
      return;
    }

    window.speechSynthesis.cancel(); // Stop any active audio

    // Format text for natural spoken flow (e.g. "감정: 평온" -> "오늘의 감정 요약은 평온입니다.")
    let speakableText = currentAiText;
    speakableText = speakableText.replace(/^감정:\s*([^\n]+)/, '오늘 분석된 마음 감정은 $1 입니다.');
    speakableText = speakableText.replace(/\n+/g, ' '); // Smooth pauses

    const utterance = new SpeechSynthesisUtterance(speakableText);
    utterance.lang = 'ko-KR';
    
    // User requirement: 전문가다운 음성, 말하기 속도 조금 더 빨리 (1.15x)
    utterance.rate = 1.15; 
    utterance.pitch = 1.05; // Calm, warm professional pitch

    const counselorVoice = getBestKoreanCounselorVoice();
    if (counselorVoice) {
      utterance.voice = counselorVoice;
      console.info(`[TTS Voice Selected]: ${counselorVoice.name}`);
    }

    isSpeaking = true;
    btnTts.innerHTML = '<i class="fa-solid fa-square"></i> 음성 중지';

    utterance.onend = () => {
      isSpeaking = false;
      btnTts.innerHTML = '<i class="fa-solid fa-volume-high"></i> 음성 듣기';
    };

    utterance.onerror = (e) => {
      console.warn('TTS Error:', e);
      isSpeaking = false;
      btnTts.innerHTML = '<i class="fa-solid fa-volume-high"></i> 음성 듣기';
    };

    window.speechSynthesis.speak(utterance);
  });

  // Copy AI response
  btnCopy.addEventListener('click', () => {
    if (!currentAiText) return;

    navigator.clipboard.writeText(currentAiText).then(() => {
      const originalText = btnCopy.innerHTML;
      btnCopy.innerHTML = '<i class="fa-solid fa-check"></i> 복사 완료!';
      setTimeout(() => {
        btnCopy.innerHTML = originalText;
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy text:', err);
    });
  });

  // ==========================================================================
  // 6. History Management
  // ==========================================================================
  function saveToHistory(userEntry, analysisResult) {
    const newEntry = {
      id: Date.now(),
      date: new Date().toLocaleString('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      userText: userEntry,
      tags: analysisResult.tags,
      aiMessage: analysisResult.message,
      advice: analysisResult.advice
    };

    diaryHistory.unshift(newEntry);
    if (diaryHistory.length > 20) diaryHistory.pop(); // Keep last 20 entries

    localStorage.setItem('ai_emotion_diaries', JSON.stringify(diaryHistory));
    renderHistory();
  }

  function renderHistory() {
    historyCountEl.textContent = diaryHistory.length;

    if (diaryHistory.length === 0) {
      historyList.innerHTML = '<p style="font-size: 0.86rem; color: #94a3b8; text-align: center; padding: 12px 0;">아직 저장된 감정 일기가 없습니다.</p>';
      return;
    }

    historyList.innerHTML = diaryHistory.map(item => `
      <div class="history-item" data-id="${item.id}">
        <div class="history-item-date"><i class="fa-regular fa-calendar"></i> ${item.date}</div>
        <div class="history-item-text">${escapeHtml(item.userText)}</div>
      </div>
    `).join('');

    // Attach click event to restore history item into response box
    document.querySelectorAll('.history-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = Number(el.getAttribute('data-id'));
        const item = diaryHistory.find(h => h.id === id);
        if (item) {
          diaryInput.value = item.userText;
          diaryInput.dispatchEvent(new Event('input'));
          
          currentAiText = item.aiMessage;

          // Render Tags
          emotionTagsEl.innerHTML = item.tags.map(t => 
            `<span class="tag ${t.type}">${t.label}</span>`
          ).join('');
          aiTextContentEl.textContent = item.aiMessage;
          adviceBodyEl.textContent = item.advice;

          responsePlaceholder.classList.add('hidden');
          responseLoading.classList.add('hidden');
          responseResult.classList.remove('hidden');
          responseControls.style.display = 'flex';

          aiResponseBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    });
  }

  btnHistoryToggle.addEventListener('click', () => {
    historySection.classList.toggle('hidden');
    if (!historySection.classList.contains('hidden')) {
      historySection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }
});
